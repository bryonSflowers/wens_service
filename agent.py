import asyncio
import json
import logging
import os
from typing import Any, AsyncGenerator, Optional

import anthropic
import asyncpg
from openai import AsyncOpenAI

import db as db_service
from tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)
MAX_TOOL_CALLS = 15
TOOL_TIMEOUT = 90

LLM_BACKEND = os.getenv("LLM_BACKEND", "claude")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

SYSTEM_PROMPT = """You are a senior financial analyst with access to a database of monthly financial reports and uploaded company documents.

The database supports multiple companies identified by ticker symbol (e.g. 3045.TW for Taiwan Mobile, 2330.TW for TSMC).
When asked about a specific company, include the ticker parameter in your report queries.

Financial Reports:
- Call list_available_reports to understand what data is available (optionally filter by ticker).
- Fetch the relevant months using get_monthly_report or get_reports_range (optionally by ticker).
- Analyse all retrieved data thoroughly.
- Produce a professional financial report structured as:
  - Executive Summary
  - Key Metrics (with exact figures)
  - Trend Analysis (MoM and YoY where applicable)
  - Highlights & Concerns
  - Recommendations

Uploaded Documents:
Use list_uploaded_docs, get_uploaded_doc, and search_documents to find, read, and analyse .txt, .csv, .xlsx, .docx files uploaded by company employees.
- First call list_uploaded_docs to see what files are available.
- Use search_documents to find specific information across files.
- Call get_uploaded_doc with a document ID to read its full content.
- Extract financial figures, tables, and key insights from these documents and incorporate them into your analysis.

Use clear headings, bullet points, and tables where helpful. Be precise with numbers."""


def _to_openai_tools(tools: list[dict]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in tools
    ]


def _metadata(**kw: Any) -> dict:
    return {k: v for k, v in kw.items() if v is not None}


async def _resolve_llm_config(
    pool: asyncpg.Pool,
    llm_config_id: Optional[int] = None,
) -> dict:
    if llm_config_id:
        row = await pool.fetchrow(
            "SELECT * FROM llm_configs WHERE id = $1 AND is_active = TRUE",
            llm_config_id,
        )
        if row:
            return {
                "provider": row["provider"],
                "model": row["model"],
                "base_url": row["base_url"],
                "api_key": row["api_key_encrypted"],
                "parameters": row["parameters"],
            }
    return {
        "provider": LLM_BACKEND,
        "model": OLLAMA_MODEL if LLM_BACKEND == "ollama" else CLAUDE_MODEL,
        "base_url": OLLAMA_BASE_URL if LLM_BACKEND == "ollama" else None,
        "api_key": None,
        "parameters": None,
    }


async def _generate_claude(
    query: str,
    pool: asyncpg.Pool,
    llm_config: Optional[dict] = None,
    user_id: Optional[int] = None,
) -> tuple[str, dict]:
    client = anthropic.AsyncAnthropic()
    messages: list[dict] = [{"role": "user", "content": query}]
    model = (llm_config or {}).get("model", CLAUDE_MODEL)

    calls = 0
    while calls < MAX_TOOL_CALLS:
        calls += 1
        try:
            async with client.messages.stream(
                model=model,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                system=SYSTEM_PROMPT,
                tools=TOOL_DEFINITIONS,
                messages=messages,
            ) as stream:
                response = await asyncio.wait_for(
                    stream.get_final_message(),
                    timeout=TOOL_TIMEOUT,
                )
        except asyncio.TimeoutError:
            logger.error("Claude request timed out after %ds", TOOL_TIMEOUT)
            return "The request timed out. Please try again.", _metadata(model=model)

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if block.type == "text":
                    return block.text, _metadata(model=model)
            return "", _metadata(model=model)

        if response.stop_reason != "tool_use":
            break

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = await execute_tool(block.name, block.input, pool, user_id)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "user", "content": tool_results})

    logger.warning("Tool loop hit max iterations (%d)", MAX_TOOL_CALLS)
    return "Report generation ended unexpectedly.", _metadata(model=model)


async def _generate_ollama(
    query: str,
    pool: asyncpg.Pool,
    llm_config: Optional[dict] = None,
    user_id: Optional[int] = None,
) -> tuple[str, dict]:
    cfg = llm_config or {}
    client = AsyncOpenAI(
        base_url=cfg.get("base_url", OLLAMA_BASE_URL),
        api_key=cfg.get("api_key", "ollama"),
    )
    model = cfg.get("model", OLLAMA_MODEL)
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    tools = _to_openai_tools(TOOL_DEFINITIONS)

    calls = 0
    while calls < MAX_TOOL_CALLS:
        calls += 1
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=tools,
                ),
                timeout=TOOL_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.error("Ollama request timed out after %ds", TOOL_TIMEOUT)
            return "The request timed out. Please try again.", _metadata(model=model)

        choice = response.choices[0]
        msg = choice.message

        assistant_turn: dict = {"role": "assistant", "content": msg.content or ""}
        if msg.tool_calls:
            assistant_turn["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        messages.append(assistant_turn)

        if choice.finish_reason == "stop" or not msg.tool_calls:
            return msg.content or "", _metadata(
                model=model,
                tokens_used=response.usage.total_tokens if response.usage else None,
                finish_reason=choice.finish_reason,
            )

        for tc in msg.tool_calls:
            result = await execute_tool(
                tc.function.name,
                json.loads(tc.function.arguments),
                pool,
                user_id,
            )
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

    logger.warning("Tool loop hit max iterations (%d)", MAX_TOOL_CALLS)
    return "Report generation ended unexpectedly.", _metadata(model=model)


async def generate_report(
    query: str,
    pool: asyncpg.Pool,
    llm_config_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> tuple[str, dict]:
    cfg = await _resolve_llm_config(pool, llm_config_id)
    provider = cfg["provider"]

    # Try Ollama
    if provider == "ollama":
        base = cfg.get("base_url", OLLAMA_BASE_URL)
        if "localhost" in base and "11434" in base:
            return (
                "⚠️ **Ollama not available in this environment.**\n\n"
                "The Ollama service is configured to run on localhost:11434, which is not accessible "
                "from this deployment. Set `ANTHROPIC_API_KEY` to use Claude, or change "
                "`OLLAMA_BASE_URL` to a remote Ollama instance.\n\n"
                "Falling back to database-generated report.\n\n",
                {"model": "none", "finish_reason": "config_error"},
            )
        try:
            return await _generate_ollama(query, pool, cfg, user_id)
        except Exception as e:
            return (f"⚠️ Ollama connection failed: {e}", {"model": "ollama", "finish_reason": "error"})

    # Try Claude — only if API key is configured
    api_key = os.getenv("ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        logger.info("ANTHROPIC_API_KEY not set — using offline mode")
    else:
        try:
            text, meta = await _generate_claude(query, pool, cfg, user_id)
            timeout_patterns = ["timed out", "request timed out", "timeout error", "asyncio.timeouterror"]
            is_timeout = any(p in text.lower() for p in timeout_patterns)
            if is_timeout:
                logger.warning("Claude timed out — falling back to offline mode")
            else:
                return text, meta
        except anthropic.AuthenticationError:
            logger.error("ANTHROPIC_API_KEY is invalid or revoked — falling back to offline mode")
        except anthropic.APIConnectionError as e:
            logger.error("Cannot reach Anthropic API: %s — falling back to offline mode", e)
            raise
        except Exception as e:
            logger.error("Unexpected error calling Claude: %s — re-raising", e)
            raise

    # Offline fallback — generate from database data directly
    try:
        reports = await db_service.list_available_reports(pool)
        if not reports:
            return ("No financial data available in the database.", {"model": "offline", "finish_reason": "no_data"})

        latest = reports[-1]
        report_data = await db_service.get_monthly_report(pool, latest["year"], latest["month"])
        metrics = []
        if report_data:
            metrics.append(f"**Period:** {report_data.get('year')}-{str(report_data.get('month')).zfill(2)}")
            if report_data.get("revenue") is not None:
                metrics.append(f"**Revenue:** NT${report_data['revenue']:,.0f}M")
            if report_data.get("net_income") is not None:
                metrics.append(f"**Net Income:** NT${report_data['net_income']:,.0f}M")
            if report_data.get("expenses") is not None:
                metrics.append(f"**Expenses:** NT${report_data['expenses']:,.0f}M")

        text = f"""# Financial Report — {latest.get('ticker', 'N/A')}

## Overview
This report was generated in **offline mode** because no LLM backend API key is configured.

## Latest Available Data
{chr(10).join(metrics)}

## Action Required
To enable AI-powered report generation, set the **ANTHROPIC_API_KEY** environment variable on Railway, or configure an Ollama backend via `LLM_BACKEND=ollama`.

## Available Reports
""" + "\n".join(f"- {r['year']}-{str(r['month']).zfill(2)} ({r.get('ticker','N/A')})" for r in reports[-10:])

        return (text, {"model": "offline", "finish_reason": "no_api_key"})
    except Exception as e:
        return (f"⚠️ Could not generate report: {e}", {"model": "none", "finish_reason": "error"})


async def chat_completion(
    messages: list[dict],
    pool: asyncpg.Pool,
    llm_config_id: Optional[int] = None,
    max_tokens: int = 4096,
    temperature: Optional[float] = None,
    user_id: Optional[int] = None,
) -> tuple[str, dict]:
    cfg = await _resolve_llm_config(pool, llm_config_id)
    provider = cfg["provider"]

    if provider == "ollama":
        client = AsyncOpenAI(
            base_url=cfg.get("base_url", OLLAMA_BASE_URL),
            api_key=cfg.get("api_key", "ollama"),
        )
        model = cfg.get("model", OLLAMA_MODEL)
        full_messages: list[dict] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages,
        ]
        tools = _to_openai_tools(TOOL_DEFINITIONS)
        kwargs: dict = {
            "model": model,
            "messages": full_messages,
            "max_tokens": max_tokens,
            "tools": tools,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature

        calls = 0
        while calls < MAX_TOOL_CALLS:
            calls += 1
            try:
                response = await asyncio.wait_for(
                    client.chat.completions.create(**kwargs),
                    timeout=TOOL_TIMEOUT,
                )
            except asyncio.TimeoutError:
                logger.error("LLM request timed out after %ds", TOOL_TIMEOUT)
                return "The request timed out. Please try again.", _metadata(model=model)
            choice = response.choices[0]
            msg = choice.message

            assistant_turn: dict = {"role": "assistant", "content": msg.content or ""}
            if msg.tool_calls:
                assistant_turn["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ]
            full_messages.append(assistant_turn)

            if choice.finish_reason == "stop" or not msg.tool_calls:
                return msg.content or "", _metadata(
                    id=response.id,
                    model=model,
                    finish_reason=choice.finish_reason,
                    tokens_used=response.usage.total_tokens if response.usage else None,
                )

            for tc in msg.tool_calls:
                result = await execute_tool(
                    tc.function.name,
                    json.loads(tc.function.arguments),
                    pool,
                    user_id,
                )
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

        logger.warning("Tool loop hit max iterations (%d)", MAX_TOOL_CALLS)
        return "Chat ended unexpectedly (too many tool calls).", _metadata(model=model)

    client = anthropic.AsyncAnthropic()
    model = cfg.get("model", CLAUDE_MODEL)
    full_messages = list(messages)
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": full_messages,
        "system": SYSTEM_PROMPT,
        "tools": TOOL_DEFINITIONS,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature

    calls = 0
    while calls < MAX_TOOL_CALLS:
        calls += 1
        try:
            response = await asyncio.wait_for(
                client.messages.create(**kwargs),
                timeout=TOOL_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.error("LLM request timed out after %ds", TOOL_TIMEOUT)
            return "The request timed out. Please try again.", _metadata(model=model)

        full_messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if block.type == "text":
                    return block.text, _metadata(id=response.id, model=model)
            return "", _metadata(id=response.id, model=model)

        if response.stop_reason != "tool_use":
            return "Chat ended unexpectedly.", _metadata(id=response.id, model=model)

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = await execute_tool(block.name, block.input, pool, user_id)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        full_messages.append({"role": "user", "content": tool_results})

    logger.warning("Tool loop hit max iterations (%d)", MAX_TOOL_CALLS)
    return "Chat ended unexpectedly (too many tool calls).", _metadata(model=model)


async def _run_tool_loop(
    messages: list[dict],
    pool: asyncpg.Pool,
    provider: str,
    model: str,
    max_tokens: int,
    temperature: Optional[float] = None,
    user_id: Optional[int] = None,
) -> str:
    if provider == "ollama":
        client = AsyncOpenAI(
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            api_key="ollama",
        )
        full_messages: list[dict] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages,
        ]
        tools = _to_openai_tools(TOOL_DEFINITIONS)
        kwargs: dict = {
            "model": model,
            "messages": full_messages,
            "max_tokens": max_tokens,
            "tools": tools,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature

        calls = 0
        while calls < MAX_TOOL_CALLS:
            calls += 1
            try:
                response = await asyncio.wait_for(
                    client.chat.completions.create(**kwargs),
                    timeout=TOOL_TIMEOUT,
                )
            except asyncio.TimeoutError:
                logger.error("LLM request timed out after %ds", TOOL_TIMEOUT)
                return "The request timed out. Please try again."
            choice = response.choices[0]
            msg = choice.message

            assistant_turn: dict = {"role": "assistant", "content": msg.content or ""}
            if msg.tool_calls:
                assistant_turn["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in msg.tool_calls
                ]
            full_messages.append(assistant_turn)

            if choice.finish_reason == "stop" or not msg.tool_calls:
                return msg.content or ""

            for tc in msg.tool_calls:
                result = await execute_tool(
                    tc.function.name,
                    json.loads(tc.function.arguments),
                    pool,
                    user_id,
                )
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

        logger.warning("Tool loop hit max iterations (%d)", MAX_TOOL_CALLS)
        return "Chat ended unexpectedly (too many tool calls)."

    client = anthropic.AsyncAnthropic()
    full_messages = list(messages)
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": full_messages,
        "system": SYSTEM_PROMPT,
        "tools": TOOL_DEFINITIONS,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature

    calls = 0
    while calls < MAX_TOOL_CALLS:
        calls += 1
        try:
            response = await asyncio.wait_for(
                client.messages.create(**kwargs),
                timeout=TOOL_TIMEOUT,
            )
        except asyncio.TimeoutError:
            logger.error("LLM request timed out after %ds", TOOL_TIMEOUT)
            return "The request timed out. Please try again."

        full_messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if block.type == "text":
                    return block.text
            return ""

        if response.stop_reason != "tool_use":
            return ""

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = await execute_tool(block.name, block.input, pool, user_id)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        full_messages.append({"role": "user", "content": tool_results})

    logger.warning("Tool loop hit max iterations (%d)", MAX_TOOL_CALLS)
    return "Chat ended unexpectedly (too many tool calls)."


async def chat_completion_stream(
    messages: list[dict],
    pool: asyncpg.Pool,
    llm_config_id: Optional[int] = None,
    max_tokens: int = 4096,
    temperature: Optional[float] = None,
    user_id: Optional[int] = None,
) -> AsyncGenerator[dict, None]:
    cfg = await _resolve_llm_config(pool, llm_config_id)
    provider = cfg["provider"]
    model = cfg.get("model", OLLAMA_MODEL if provider == "ollama" else CLAUDE_MODEL)

    if provider == "ollama":
        client = AsyncOpenAI(
            base_url=cfg.get("base_url", OLLAMA_BASE_URL),
            api_key=cfg.get("api_key", "ollama"),
        )
        full_messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages,
        ]
        tools = _to_openai_tools(TOOL_DEFINITIONS)
        kwargs: dict = {
            "model": model,
            "messages": full_messages,
            "max_tokens": max_tokens,
            "stream": True,
            "tools": tools,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        try:
            stream = await client.chat.completions.create(**kwargs)
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield {"type": "content", "text": delta.content}
                if chunk.choices and chunk.choices[0].finish_reason == "stop":
                    break
        except Exception as e:
            logger.error("Stream error: %s", e)
            yield {"type": "content", "text": f"\n\nError: {e}"}
        return

    client = anthropic.AsyncAnthropic()
    try:
        async with client.messages.stream(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta" and hasattr(event.delta, "text"):
                    yield {"type": "content", "text": event.delta.text}
    except Exception as e:
        logger.error("Claude stream error: %s", e)
        yield {"type": "content", "text": f"\n\nError: {e}"}
