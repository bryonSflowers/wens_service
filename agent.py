import asyncio
import json
import logging
import os
from typing import Any, AsyncGenerator, Optional

import anthropic
import asyncpg
from openai import AsyncOpenAI

from tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)
MAX_TOOL_CALLS = 20
TOOL_TIMEOUT = 120

LLM_BACKEND = os.getenv("LLM_BACKEND", "claude")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")

SYSTEM_PROMPT = """You are a senior financial analyst with access to a database of monthly financial reports and uploaded company documents.

Financial Reports:
- Call list_available_reports to understand what data is available.
- Fetch the relevant months using get_monthly_report or get_reports_range.
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
    if provider == "ollama":
        return await _generate_ollama(query, pool, cfg, user_id)
    return await _generate_claude(query, pool, cfg, user_id)


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

    text = await _run_tool_loop(
        messages, pool, provider, model, max_tokens, temperature, user_id
    )
    yield {"type": "content", "text": text}
