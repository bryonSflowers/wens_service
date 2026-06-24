import json
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, Optional

import db as db_service
from schemas.kv_store import KVItemCreate, KVItemUpdate, KVItemResponse, KVSearchParams
from schemas.common import PaginatedResponse
from middleware import get_current_user_optional

router = APIRouter(prefix="/kv", tags=["Key-Value Store"])


@router.get("/{namespace}", response_model=PaginatedResponse)
async def list_namespace(
    namespace: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    pool = await db_service.get_pool()
    return await db_service.get_paginated(
        pool, "kv_store",
        where="namespace = $1",
        params=[namespace],
        order_by="key ASC",
        page=page, page_size=page_size,
    )


@router.get("/{namespace}/{key}", response_model=KVItemResponse)
async def get_kv_item(namespace: str, key: str):
    pool = await db_service.get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM kv_store WHERE namespace = $1 AND key = $2",
        namespace, key,
    )
    if not row:
        raise HTTPException(404, f"Key '{key}' not found in namespace '{namespace}'")
    return db_service._serialize_row(row)


@router.put("/{namespace}/{key}", response_model=KVItemResponse)
async def upsert_kv_item(
    namespace: str, key: str,
    body: KVItemCreate,
    current_user: dict = Depends(get_current_user_optional),
):
    pool = await db_service.get_pool()
    user_id = current_user["id"] if current_user else None
    row = await pool.fetchrow(
        "INSERT INTO kv_store (namespace, key, value, tags) "
        "VALUES ($1, $2, $3::jsonb, $4) "
        "ON CONFLICT (namespace, key) DO UPDATE SET "
        "value = $3::jsonb, tags = $4, updated_at = NOW() "
        "RETURNING *",
        namespace, key, json.dumps(body.value) if not isinstance(body.value, str) else body.value,
        body.tags,
    )
    await db_service.log_audit(pool, user_id, "kv.upsert", "kv_store", f"{namespace}/{key}")
    return db_service._serialize_row(row)


@router.delete("/{namespace}/{key}", status_code=204)
async def delete_kv_item(
    namespace: str, key: str,
    current_user: dict = Depends(get_current_user_optional),
):
    pool = await db_service.get_pool()
    user_id = current_user["id"] if current_user else None
    r = await pool.execute(
        "DELETE FROM kv_store WHERE namespace = $1 AND key = $2",
        namespace, key,
    )
    if r == "DELETE 0":
        raise HTTPException(404, f"Key '{key}' not found in namespace '{namespace}'")
    await db_service.log_audit(pool, user_id, "kv.delete", "kv_store", f"{namespace}/{key}")


@router.post("/{namespace}/search", response_model=list[KVItemResponse])
async def search_namespace(namespace: str, body: KVSearchParams):
    pool = await db_service.get_pool()
    conditions = ["namespace = $1"]
    params: list = [namespace]
    idx = 2

    if body.tags:
        conditions.append(f"tags @> ${idx}")
        params.append(body.tags)
        idx += 1

    if body.value_match:
        for k, v in body.value_match.items():
            conditions.append(f"value->>'{k}' = ${idx}")
            params.append(str(v))
            idx += 1

    where = " AND ".join(conditions)
    offset = (body.page - 1) * body.page_size
    rows = await pool.fetch(
        f"SELECT * FROM kv_store WHERE {where} ORDER BY updated_at DESC "
        f"LIMIT ${idx} OFFSET ${idx + 1}",
        *params, body.page_size, offset,
    )
    return db_service._serialize_rows(rows)
