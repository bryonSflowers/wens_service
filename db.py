"""
Expected PostgreSQL table schema:

    CREATE TABLE monthly_reports (
        id          SERIAL PRIMARY KEY,
        year        INTEGER NOT NULL,
        month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        revenue     NUMERIC(15, 2),
        expenses    NUMERIC(15, 2),
        net_income  NUMERIC(15, 2),
        report_data JSONB,          -- any additional structured data
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE (year, month)
    );
"""
import os
from decimal import Decimal
from typing import Optional

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


def _row(record: asyncpg.Record) -> dict:
    d = dict(record)
    for k, v in d.items():
        if isinstance(v, Decimal):
            d[k] = float(v)
    return d


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
    return [_row(r) for r in rows]


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
    return _row(row) if row else None


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
    return [_row(r) for r in rows]
