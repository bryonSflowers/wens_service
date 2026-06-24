from fastapi import APIRouter, Depends, Query

import db as db_service
from schemas.common import PaginatedResponse, HealthResponse
from config import settings
from middleware import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/health", response_model=HealthResponse)
async def admin_health():
    pool = await db_service.get_pool()
    db_ok = "disconnected"
    try:
        await pool.fetchval("SELECT 1")
        db_ok = "connected"
    except Exception:
        db_ok = "disconnected"
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        database=db_ok,
    )


@router.get("/stats")
async def stats(current_user: dict = Depends(require_role("admin"))):
    pool = await db_service.get_pool()
    async with pool.acquire() as conn:
        users = await conn.fetchval("SELECT COUNT(*) FROM users")
        reports = await conn.fetchval("SELECT COUNT(*) FROM monthly_reports")
        generated = await conn.fetchval("SELECT COUNT(*) FROM generated_reports")
        templates = await conn.fetchval("SELECT COUNT(*) FROM report_templates")
        kv_items = await conn.fetchval("SELECT COUNT(*) FROM kv_store")
        api_keys = await conn.fetchval("SELECT COUNT(*) FROM api_keys")
        llm_configs = await conn.fetchval("SELECT COUNT(*) FROM llm_configs")
    return {
        "users": users,
        "monthly_reports": reports,
        "generated_reports": generated,
        "report_templates": templates,
        "kv_store_items": kv_items,
        "api_keys": api_keys,
        "llm_configs": llm_configs,
    }


@router.get("/audit-logs", response_model=PaginatedResponse)
async def audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_role("admin")),
):
    pool = await db_service.get_pool()
    return await db_service.get_paginated(
        pool, "audit_logs",
        order_by="created_at DESC",
        page=page, page_size=page_size,
    )
