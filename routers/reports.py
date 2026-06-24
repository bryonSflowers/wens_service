from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

import db as db_service
import agent
from config import settings
from schemas.reports import (
    ReportResponse, ReportGenerateRequest, ReportGenerateResponse,
)
from schemas.common import PaginatedResponse
from middleware import get_current_user_optional

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("", response_model=PaginatedResponse)
async def list_reports(
    year: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    pool = await db_service.get_pool()
    where = None
    params: list = []
    if year:
        where = "year = $1"
        params = [year]
    result = await db_service.get_paginated(
        pool, "monthly_reports",
        where=where, params=params if params else None,
        order_by="year DESC, month DESC",
        page=page, page_size=page_size,
    )
    return result


@router.get("/{year}/{month}", response_model=ReportResponse)
async def get_report(year: int, month: int):
    pool = await db_service.get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM monthly_reports WHERE year = $1 AND month = $2",
        year, month,
    )
    if not row:
        raise HTTPException(404, f"No report for {year}-{month:02d}")
    return db_service._serialize_row(row)


@router.get("/range", response_model=list[ReportResponse])
async def get_reports_range(
    start_year: int, start_month: int,
    end_year: int, end_month: int,
):
    pool = await db_service.get_pool()
    rows = await pool.fetch(
        "SELECT * FROM monthly_reports "
        "WHERE (year > $1 OR (year = $1 AND month >= $2)) "
        "AND (year < $3 OR (year = $3 AND month <= $4)) "
        "ORDER BY year, month",
        start_year, start_month, end_year, end_month,
    )
    return db_service._serialize_rows(rows)


@router.post("/generate", response_model=ReportGenerateResponse)
async def generate_report(
    body: ReportGenerateRequest,
    current_user: dict = Depends(get_current_user_optional),
):
    pool = await db_service.get_pool()
    user_id = current_user["id"] if current_user else None
    try:
        report_text, metadata = await agent.generate_report(
            query=body.query,
            pool=pool,
            llm_config_id=body.llm_config_id,
        )
    except Exception as exc:
        raise HTTPException(500, str(exc))

    row = await pool.fetchrow(
        "INSERT INTO generated_reports (user_id, query, report, model, tokens_used, llm_config_id) "
        "VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at",
        user_id, body.query, report_text,
        metadata.get("model"), metadata.get("tokens_used"),
        metadata.get("llm_config_id"),
    )
    await db_service.log_audit(pool, user_id, "report.generate", "generated_reports", str(row["id"]))
    return ReportGenerateResponse(
        id=row["id"], query=body.query, report=report_text,
        model=metadata.get("model"), tokens_used=metadata.get("tokens_used"),
        created_at=row["created_at"],
    )
