import json
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

import asyncpg

_pool: Optional[asyncpg.Pool] = None


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"])


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised")
    return _pool


def _serialize_row(record: asyncpg.Record) -> dict:
    d = dict(record)
    for k, v in d.items():
        if isinstance(v, Decimal):
            d[k] = float(v)
        elif isinstance(v, (datetime, date)):
            d[k] = v.isoformat()
    return d


def _serialize_rows(rows: list[asyncpg.Record]) -> list[dict]:
    return [_serialize_row(r) for r in rows]


async def list_available_reports(
    pool: asyncpg.Pool,
    year: Optional[int] = None,
) -> list[dict]:
    if year:
        rows = await pool.fetch(
            "SELECT year, month FROM monthly_reports WHERE year = $1 ORDER BY year, month",
            year,
        )
    else:
        rows = await pool.fetch(
            "SELECT year, month FROM monthly_reports ORDER BY year DESC, month DESC"
        )
    return [_serialize_row(r) for r in rows]


async def get_monthly_report(
    pool: asyncpg.Pool,
    year: int,
    month: int,
) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT * FROM monthly_reports WHERE year = $1 AND month = $2",
        year,
        month,
    )
    return _serialize_row(row) if row else None


async def get_reports_range(
    pool: asyncpg.Pool,
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
) -> list[dict]:
    rows = await pool.fetch(
        """
        SELECT * FROM monthly_reports
        WHERE (year > $1 OR (year = $1 AND month >= $2))
          AND (year < $3 OR (year = $3 AND month <= $4))
        ORDER BY year, month
        """,
        start_year,
        start_month,
        end_year,
        end_month,
    )
    return [_serialize_row(r) for r in rows]


async def get_paginated(
    pool: asyncpg.Pool,
    table: str,
    columns: str = "*",
    where: Optional[str] = None,
    params: Optional[list] = None,
    order_by: str = "id DESC",
    page: int = 1,
    page_size: int = 20,
) -> dict:
    offset = (page - 1) * page_size
    where_clause = f"WHERE {where}" if where else ""
    if params is None:
        params = []

    async with pool.acquire() as conn:
        total = await conn.fetchval(f"SELECT COUNT(*) FROM {table} {where_clause}", *params)
        idx = len(params)
        data_sql = (
            f"SELECT {columns} FROM {table} {where_clause} "
            f"ORDER BY {order_by} LIMIT ${idx + 1} OFFSET ${idx + 2}"
        )
        rows = await conn.fetch(data_sql, *params, page_size, offset)

    return {
        "items": _serialize_rows(rows),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


async def log_audit(
    pool: asyncpg.Pool,
    user_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    await pool.execute(
        "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address) "
        "VALUES ($1, $2, $3, $4, $5::jsonb, $6)",
        user_id, action, resource_type, resource_id,
        json.dumps(details) if details else None,
        ip_address,
    )
