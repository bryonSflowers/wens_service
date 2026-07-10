import json
from datetime import date, datetime
from typing import Any, Optional

import asyncpg

import db

TOOL_DEFINITIONS = [
    {
        "name": "list_available_reports",
        "description": (
            "List all available monthly financial reports stored in the database. "
            "Call this first to understand what data exists before fetching specifics. "
            "Optionally filter by ticker (e.g. '3045.TW' for Taiwan Mobile)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {
                    "type": "integer",
                    "description": "Optional: filter results to a specific year.",
                },
                "ticker": {
                    "type": "string",
                    "description": "Optional: stock ticker symbol (e.g. '3045.TW', '2330.TW').",
                },
            },
        },
    },
    {
        "name": "get_monthly_report",
        "description": "Fetch the full financial data for a single month. Optionally specify a ticker.",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer", "description": "4-digit year, e.g. 2025"},
                "month": {"type": "integer", "description": "Month number 1–12"},
                "ticker": {"type": "string", "description": "Optional: ticker symbol (default '3045.TW')."},
            },
            "required": ["year", "month"],
        },
    },
    {
        "name": "get_reports_range",
        "description": (
            "Fetch all monthly reports within an inclusive date range. "
            "Use this to retrieve multiple consecutive months at once. "
            "Optionally filter by ticker."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_year": {"type": "integer"},
                "start_month": {"type": "integer"},
                "end_year": {"type": "integer"},
                "end_month": {"type": "integer"},
                "ticker": {"type": "string", "description": "Optional: ticker symbol filter."},
            },
            "required": ["start_year", "start_month", "end_year", "end_month"],
        },
    },
    {
        "name": "list_uploaded_docs",
        "description": (
            "List all uploaded documents that are available for analysis. "
            "Returns filename, type, word count, and creation date for each document. "
            "Call this to discover what documents have been uploaded before searching their content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "page": {"type": "integer", "description": "Page number (default 1)"},
                "page_size": {"type": "integer", "description": "Items per page (default 20)"},
            },
        },
    },
    {
        "name": "get_uploaded_doc",
        "description": (
            "Fetch the full parsed content of a specific uploaded document by its ID. "
            "Use this after list_uploaded_docs to read the actual content of a relevant document. "
            "The content includes all text extracted from the file (Excel tables, Word paragraphs, etc.)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "doc_id": {"type": "integer", "description": "The document ID from list_uploaded_docs"},
            },
            "required": ["doc_id"],
        },
    },
    {
        "name": "search_documents",
        "description": (
            "Search the content of uploaded documents for a keyword or phrase. "
            "Returns matching document IDs, filenames, and the surrounding text. "
            "Use this to find specific data points across all uploaded files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keyword or phrase to search for in document content"},
                "max_results": {"type": "integer", "description": "Maximum number of results to return (default 5)"},
            },
            "required": ["query"],
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
    user_id: Optional[int] = None,
) -> str:
    try:
        if name == "list_available_reports":
            result = await db.list_available_reports(pool, inputs.get("year"), inputs.get("ticker"))
        elif name == "get_monthly_report":
            result = await db.get_monthly_report(pool, inputs["year"], inputs["month"], inputs.get("ticker"))
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
                inputs.get("ticker"),
            )
        elif name == "list_uploaded_docs":
            page = inputs.get("page", 1)
            page_size = inputs.get("page_size", 20)
            uid = user_id or 0
            result = await db.get_paginated(
                pool, "uploaded_docs",
                columns="id, filename, file_type, word_count, created_at",
                where="user_id = $1",
                params=[uid],
                order_by="created_at DESC",
                page=page, page_size=page_size,
            )
        elif name == "get_uploaded_doc":
            uid = user_id or 0
            row = await pool.fetchrow(
                "SELECT id, filename, file_type, content, raw_tables, word_count, created_at "
                "FROM uploaded_docs WHERE id = $1 AND user_id = $2",
                inputs["doc_id"], uid,
            )
            if not row:
                return json.dumps({"error": f"Document {inputs['doc_id']} not found"})
            result = db._serialize_row(row)
        elif name == "search_documents":
            uid = user_id or 0
            query = inputs["query"]
            max_results = inputs.get("max_results", 5)
            rows = await pool.fetch(
                "SELECT id, filename, file_type, content, word_count, created_at "
                "FROM uploaded_docs WHERE user_id = $1 "
                "AND (LOWER(content) LIKE LOWER($2) OR LOWER(filename) LIKE LOWER($2)) "
                "ORDER BY created_at DESC LIMIT $3",
                uid, f"%{query}%", max_results,
            )
            results = []
            for r in rows:
                d = dict(r)
                content = d.get("content", "") or ""
                idx = content.lower().find(query.lower())
                snippet = ""
                if idx >= 0:
                    start = max(0, idx - 100)
                    end = min(len(content), idx + len(query) + 200)
                    snippet = content[start:end]
                results.append({
                    "id": d["id"],
                    "filename": d["filename"],
                    "type": d["file_type"],
                    "word_count": d["word_count"],
                    "snippet": snippet,
                    "created_at": d["created_at"].isoformat() if isinstance(d["created_at"], datetime) else str(d["created_at"]),
                })
            result = results
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

        return json.dumps(result, default=_serialize)

    except Exception as exc:
        return json.dumps({"error": str(exc)})
