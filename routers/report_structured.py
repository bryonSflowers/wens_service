"""
Structured report generation — LLM returns typed sections rendered by React.
"""
import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException

import db as db_service
from middleware import get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Reports"])


STRUCTURED_PROMPT = """You are a senior financial analyst. Analyze the data and return a structured report as a JSON array of sections.

Each section must follow this exact schema:
- {"type": "metric_grid", "title": "...", "items": [{"label": "...", "value": "...", "change?": "..."}]} for KPI cards
- {"type": "chart", "title": "...", "chartType": "bar|line", "labels": [...], "datasets": [{"label": "...", "data": [...]}]} for charts
- {"type": "insight", "icon": "up|down|warning|info", "text": "..."} for key callouts
- {"type": "narrative", "title": "...", "text": "..."} for prose paragraphs
- {"type": "table", "title": "...", "headers": [...], "rows": [[...], ...]} for data tables

Return ONLY the JSON array — no markdown, no code fences, no commentary.
Use specific numbers from the database. Be precise and quantitative."""


async def _generate_structured(query: str, pool) -> tuple[list[dict], str, dict]:
    """Call Claude structured, parse sections. Fall back to text on error."""
    import os
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return _offline_sections(pool), "", {"model": "offline", "finish_reason": "no_key"}

    client = anthropic.AsyncAnthropic(api_key=api_key)
    prompt = f"{STRUCTURED_PROMPT}\n\nQuery: {query}"

    try:
        resp = await client.messages.create(
            model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=4096,
            system="You are a senior financial analyst. Always return valid JSON arrays.",
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in resp.content if block.type == "text")
        sections = json.loads(text)
        if isinstance(sections, list):
            return sections, "", {"model": resp.model, "finish_reason": "success"}
        return _offline_sections(pool), text, {"model": resp.model, "finish_reason": "parse_error"}
    except Exception as e:
        logger.warning("Structured generation failed: %s", e)
        return _offline_sections(pool), "", {"model": "none", "finish_reason": "error"}


def _offline_sections(pool) -> list[dict]:
    return [
        {"type": "insight", "icon": "info", "text": "Configure ANTHROPIC_API_KEY in Railway environment variables to enable AI-powered structured reports."},
        {"type": "narrative", "title": "Offline Mode", "text": "Reports are generated from database data when no LLM backend is configured. Set ANTHROPIC_API_KEY for AI-powered analysis with charts, metrics, and insights."},
    ]


@router.post("/generate-structured")
async def generate_structured_report(
    body: dict,
    current_user: dict = Depends(get_current_user_optional),
):
    pool = await db_service.get_pool()
    query = body.get("query", "")
    if not query:
        raise HTTPException(400, "query is required")

    sections, fallback_text, metadata = await _generate_structured(query, pool)

    user_id = current_user["id"] if current_user else None
    await db_service.log_audit(pool, user_id, "report.generate_structured", "generated_reports",
                                details={"model": metadata.get("model"), "section_count": len(sections)})

    return {
        "sections": sections,
        "model": metadata.get("model"),
        "finish_reason": metadata.get("finish_reason"),
    }
