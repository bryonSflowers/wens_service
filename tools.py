import json
from datetime import date, datetime
from typing import Any

import asyncpg

import db

TOOL_DEFINITIONS = [
    {
        "name": "list_available_reports",
        "description": (
            "List all available monthly financial reports stored in the database. "
            "Call this first to understand what data exists before fetching specifics."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {
                    "type": "integer",
                    "description": "Optional: filter results to a specific year.",
                }
            },
        },
    },
    {
        "name": "get_monthly_report",
        "description": "Fetch the full financial data for a single month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer", "description": "4-digit year, e.g. 2025"},
                "month": {"type": "integer", "description": "Month number 1–12"},
            },
            "required": ["year", "month"],
        },
    },
    {
        "name": "get_reports_range",
        "description": (
            "Fetch all monthly reports within an inclusive date range. "
            "Use this to retrieve multiple consecutive months at once."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_year": {"type": "integer"},
                "start_month": {"type": "integer"},
                "end_year": {"type": "integer"},
                "end_month": {"type": "integer"},
            },
            "required": ["start_year", "start_month", "end_year", "end_month"],
        },
    },
]


def _serialize(obj: Any) -> Any:
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Cannot serialize {type(obj)}")


async def execute_tool(
    name: str,
    inputs: dict,
    pool: asyncpg.Pool,
) -> str:
    try:
        if name == "list_available_reports":
            result = await db.list_available_reports(pool, inputs.get("year"))
        elif name == "get_monthly_report":
            result = await db.get_monthly_report(pool, inputs["year"], inputs["month"])
            if result is None:
                return json.dumps(
                    {"error": f"No report for {inputs['year']}-{inputs['month']:02d}"}
                )
        elif name == "get_reports_range":
            result = await db.get_reports_range(
                pool,
                inputs["start_year"],
                inputs["start_month"],
                inputs["end_year"],
                inputs["end_month"],
            )
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

        return json.dumps(result, default=_serialize)

    except Exception as exc:
        return json.dumps({"error": str(exc)})
