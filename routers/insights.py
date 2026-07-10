"""
Proactive AI Insights — generated after market sync, surfaced on dashboard.
"""
import asyncio
import json
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

import db as db_service
from middleware import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["AI Insights"])


@router.get("")
async def list_insights(
    ticker: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user),
):
    pool = await db_service.get_pool()
    if ticker:
        rows = await pool.fetch(
            "SELECT * FROM ai_insights WHERE ticker = $1 ORDER BY created_at DESC LIMIT $2",
            ticker.upper(), limit,
        )
    else:
        rows = await pool.fetch(
            "SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT $1", limit
        )
    return db_service._serialize_rows(rows)


@router.get("/latest")
async def latest_insights(current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    rows = await pool.fetch(
        "SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT 5"
    )
    return db_service._serialize_rows(rows)
