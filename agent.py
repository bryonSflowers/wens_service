import json
import os

import anthropic
import asyncpg
from openai import AsyncOpenAI

from tools import TOOL_DEFINITIONS, execute_tool

LLM_BACKEND = os.getenv("LLM_BACKEND", "ollama")   # "claude" | "ollama"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")

SYSTEM_PROMPT = """You are a senior financial analyst with access to a database of monthly financial reports.

When generating a report or analysis:
1. Call list_available_reports to understand what data is available.
2. Fetch the relevant months using get_monthly_report or get_reports_range.
3. Analyse all retrieved data thoroughly.
4. Produce a professional financial report structured as:
   - Executive Summary
   - Key Metrics (with exact figures)
   - Trend Analysis (MoM and YoY where applicable)
   - Highlights & Concerns
   - Recommendations

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


async def _generate_claude(query: str, pool: asyncpg.Pool) -> str:
    client = anthropic.AsyncAnthropic()
    messages: list[dict] = [{"role": "user", "content": query}]

    while True:
        async with client.messages.stream(
            model="claude-opus-4-7",
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=messages,
        ) as stream:
            response = await stream.get_final_message()

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if block.type == "text":
                    return block.text
            return ""

        if response.stop_reason != "tool_use":
            break

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = await execute_tool(block.name, block.input, pool)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    }
                )

        messages.append({"role": "user", "content": tool_results})

    return "Report generation ended unexpectedly."


async def _generate_ollama(query: str, pool: asyncpg.Pool) -> str:
    client = AsyncOpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    tools = _to_openai_tools(TOOL_DEFINITIONS)

    while True:
        response = await client.chat.completions.create(
            model=OLLAMA_MODEL,
            messages=messages,
            tools=tools,
        )

        choice = response.choices[0]
        msg = choice.message

        # Append assistant turn as a plain dict so it serialises cleanly
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
            return msg.content or ""

        for tc in msg.tool_calls:
            result = await execute_tool(
                tc.function.name,
                json.loads(tc.function.arguments),
                pool,
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                }
            )

    return "Report generation ended unexpectedly."


async def generate_report(query: str, pool: asyncpg.Pool) -> str:
    if LLM_BACKEND == "ollama":
        return await _generate_ollama(query, pool)
    return await _generate_claude(query, pool)
