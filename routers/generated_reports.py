from fastapi import APIRouter, Depends, HTTPException, Query

import db as db_service
from schemas.reports import ReportGenerateResponse
from schemas.common import PaginatedResponse
from middleware import get_current_user_optional

router = APIRouter(prefix="/generated-reports", tags=["Generated Reports History"])


@router.get("", response_model=PaginatedResponse)
async def list_generated_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user_optional),
):
    pool = await db_service.get_pool()
    user_id = current_user["id"] if current_user else None
    if user_id:
        return await db_service.get_paginated(
            pool, "generated_reports",
            where="user_id = $1",
            params=[user_id],
            order_by="created_at DESC",
            page=page, page_size=page_size,
        )
    return await db_service.get_paginated(
        pool, "generated_reports",
        order_by="created_at DESC",
        page=page, page_size=page_size,
    )


@router.get("/{report_id}", response_model=ReportGenerateResponse)
async def get_generated_report(report_id: int):
    pool = await db_service.get_pool()
    row = await pool.fetchrow("SELECT * FROM generated_reports WHERE id = $1", report_id)
    if not row:
        raise HTTPException(404, "Generated report not found")
    return {
        "id": row["id"],
        "query": row["query"],
        "report": row["report"],
        "model": row["model"],
        "tokens_used": row["tokens_used"],
        "created_at": row["created_at"],
    }


@router.delete("/{report_id}", status_code=204)
async def delete_generated_report(report_id: int):
    pool = await db_service.get_pool()
    r = await pool.execute("DELETE FROM generated_reports WHERE id = $1", report_id)
    if r == "DELETE 0":
        raise HTTPException(404, "Generated report not found")
