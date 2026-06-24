from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

import db as db_service
from schemas.templates import TemplateCreate, TemplateUpdate, TemplateResponse
from schemas.common import PaginatedResponse
from middleware import get_current_user, get_current_user_optional

router = APIRouter(prefix="/templates", tags=["Report Templates"])


@router.get("", response_model=PaginatedResponse)
async def list_templates(page: int = 1, page_size: int = 20):
    pool = await db_service.get_pool()
    return await db_service.get_paginated(
        pool, "report_templates",
        order_by="created_at DESC",
        page=page, page_size=page_size,
    )


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(
    body: TemplateCreate,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    pool = await db_service.get_pool()
    user_id = current_user["id"] if current_user else None
    row = await pool.fetchrow(
        "INSERT INTO report_templates (name, description, query_text, parameters_schema, is_public, created_by) "
        "VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *",
        body.name, body.description, body.query_text,
        body.parameters_schema, body.is_public, user_id,
    )
    return db_service._serialize_row(row)


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int):
    pool = await db_service.get_pool()
    row = await pool.fetchrow("SELECT * FROM report_templates WHERE id = $1", template_id)
    if not row:
        raise HTTPException(404, "Template not found")
    return db_service._serialize_row(row)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: int, body: TemplateUpdate):
    pool = await db_service.get_pool()
    existing = await pool.fetchrow("SELECT * FROM report_templates WHERE id = $1", template_id)
    if not existing:
        raise HTTPException(404, "Template not found")

    fields = {}
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            fields[k] = v

    if not fields:
        return db_service._serialize_row(existing)

    set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(fields.keys()))
    fields["updated_at"] = "NOW()"
    vals = list(fields.values()) + [template_id]
    row = await pool.fetchrow(
        f"UPDATE report_templates SET {set_clause}, updated_at = NOW() WHERE id = ${len(vals)} RETURNING *",
        *vals,
    )
    return db_service._serialize_row(row)


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: int):
    pool = await db_service.get_pool()
    r = await pool.execute("DELETE FROM report_templates WHERE id = $1", template_id)
    if r == "DELETE 0":
        raise HTTPException(404, "Template not found")
