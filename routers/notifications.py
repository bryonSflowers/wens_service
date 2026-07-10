"""
In-app notification center.
"""
from typing import Optional

from fastapi import APIRouter, Depends

import db as db_service
from middleware import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user),
):
    pool = await db_service.get_pool()
    where = "user_id = $1"
    params = [current_user["id"]]
    if unread_only:
        where += " AND is_read = FALSE"
    return await db_service.get_paginated(
        pool, "notifications",
        where=where, params=params,
        order_by="created_at DESC",
        page=page, page_size=page_size,
    )


@router.post("/{notif_id}/read")
async def mark_read(
    notif_id: int,
    current_user: dict = Depends(get_current_user),
):
    pool = await db_service.get_pool()
    await pool.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
        notif_id, current_user["id"],
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    await pool.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
        current_user["id"],
    )
    return {"ok": True}


@router.get("/unread-count")
async def unread_count(current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    count = await pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        current_user["id"],
    )
    return {"count": count}
