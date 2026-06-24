import csv
import io
import json
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

import db as db_service

router = APIRouter(prefix="/export", tags=["Data Export"])


@router.get("/reports")
async def export_reports(
    format: str = Query("json", pattern="^(csv|json)$"),
    year: int = Query(None),
    page_size: int = Query(1000, le=10000),
):
    pool = await db_service.get_pool()
    where = None
    params = None
    if year:
        where = "year = $1"
        params = [year]

    result = await db_service.get_paginated(
        pool, "monthly_reports",
        columns="year, month, revenue, expenses, net_income, notes",
        where=where, params=params,
        order_by="year, month",
        page=1, page_size=page_size,
    )

    if format == "json":
        content = json.dumps(result["items"], indent=2, ensure_ascii=False)
        return StreamingResponse(
            iter([content.encode()]),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=reports.json"},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    items = result["items"]
    if items:
        writer.writerow(items[0].keys())
        for item in items:
            writer.writerow(item.values())
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reports.csv"},
    )


@router.get("/generated")
async def export_generated_reports(
    format: str = Query("json", pattern="^(csv|json)$"),
    page_size: int = Query(1000, le=10000),
):
    pool = await db_service.get_pool()
    result = await db_service.get_paginated(
        pool, "generated_reports",
        columns="id, query, model, tokens_used, created_at",
        order_by="created_at DESC",
        page=1, page_size=page_size,
    )

    if format == "json":
        content = json.dumps(result["items"], indent=2, ensure_ascii=False)
        return StreamingResponse(
            iter([content.encode()]),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=generated_reports.json"},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    items = result["items"]
    if items:
        writer.writerow(items[0].keys())
        for item in items:
            writer.writerow(item.values())
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=generated_reports.csv"},
    )
