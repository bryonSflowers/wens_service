import json
from fastapi import APIRouter, Depends, HTTPException

import db as db_service
from encryption import encrypt, decrypt
from schemas.llm_configs import (
    LLMConfigCreate, LLMConfigUpdate, LLMConfigResponse,
)
from schemas.common import PaginatedResponse
from middleware import get_current_user, require_role

router = APIRouter(prefix="/llm-configs", tags=["LLM Configurations"])


@router.get("", response_model=PaginatedResponse)
async def list_llm_configs(page: int = 1, page_size: int = 20):
    pool = await db_service.get_pool()
    return await db_service.get_paginated(
        pool, "llm_configs",
        order_by="created_at DESC",
        page=page, page_size=page_size,
    )


@router.post("", response_model=LLMConfigResponse, status_code=201)
async def create_llm_config(
    body: LLMConfigCreate,
    current_user: dict = Depends(require_role("admin")),
):
    pool = await db_service.get_pool()
    api_key_encrypted = encrypt(body.api_key) if body.api_key else None
    row = await pool.fetchrow(
        "INSERT INTO llm_configs (name, provider, model, base_url, api_key_encrypted, parameters, is_active) "
        "VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING *",
        body.name, body.provider, body.model, body.base_url,
        api_key_encrypted, json.dumps(body.parameters) if body.parameters else None,
        body.is_active,
    )
    await db_service.log_audit(pool, current_user["id"], "llm_config.create", "llm_configs", str(row["id"]))
    return db_service._serialize_row(row)


@router.get("/{config_id}", response_model=LLMConfigResponse)
async def get_llm_config(config_id: int):
    pool = await db_service.get_pool()
    row = await pool.fetchrow("SELECT * FROM llm_configs WHERE id = $1", config_id)
    if not row:
        raise HTTPException(404, "LLM config not found")
    result = db_service._serialize_row(row)
    if result.get("api_key_encrypted"):
        result["api_key_plaintext"] = decrypt(result["api_key_encrypted"])
    return result


@router.put("/{config_id}", response_model=LLMConfigResponse)
async def update_llm_config(
    config_id: int,
    body: LLMConfigUpdate,
    current_user: dict = Depends(require_role("admin")),
):
    pool = await db_service.get_pool()
    existing = await pool.fetchrow("SELECT * FROM llm_configs WHERE id = $1", config_id)
    if not existing:
        raise HTTPException(404, "LLM config not found")

    fields = {}
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            if k == "api_key":
                fields["api_key_encrypted"] = encrypt(v)
            elif k == "parameters":
                fields[k] = json.dumps(v) if v else None
            else:
                fields[k] = v

    if not fields:
        return db_service._serialize_row(existing)

    set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(fields.keys()))
    vals = list(fields.values()) + [config_id]
    row = await pool.fetchrow(
        f"UPDATE llm_configs SET {set_clause}, updated_at = NOW() WHERE id = ${len(vals)} RETURNING *",
        *vals,
    )
    return db_service._serialize_row(row)


@router.delete("/{config_id}", status_code=204)
async def delete_llm_config(
    config_id: int,
    current_user: dict = Depends(require_role("admin")),
):
    pool = await db_service.get_pool()
    r = await pool.execute("DELETE FROM llm_configs WHERE id = $1", config_id)
    if r == "DELETE 0":
        raise HTTPException(404, "LLM config not found")
