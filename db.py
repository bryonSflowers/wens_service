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


# ---------------------------------------------------------------------------
# PORTFOLIO SERVICE
# ---------------------------------------------------------------------------

async def create_portfolio(pool: asyncpg.Pool, user_id: int, name: str, description: Optional[str] = None) -> dict:
    row = await pool.fetchrow(
        "INSERT INTO portfolios (user_id, name, description) VALUES ($1, $2, $3) RETURNING *",
        user_id, name, description,
    )
    return _serialize_row(row)


async def list_portfolios(pool: asyncpg.Pool, user_id: int) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM portfolios WHERE user_id = $1 ORDER BY created_at DESC", user_id
    )
    return _serialize_rows(rows)


async def get_portfolio(pool: asyncpg.Pool, portfolio_id: int, user_id: int) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT * FROM portfolios WHERE id = $1 AND user_id = $2", portfolio_id, user_id
    )
    return _serialize_row(row) if row else None


async def update_portfolio(pool: asyncpg.Pool, portfolio_id: int, user_id: int, name: str, description: Optional[str] = None) -> Optional[dict]:
    row = await pool.fetchrow(
        "UPDATE portfolios SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *",
        name, description, portfolio_id, user_id,
    )
    return _serialize_row(row) if row else None


async def delete_portfolio(pool: asyncpg.Pool, portfolio_id: int, user_id: int) -> bool:
    r = await pool.execute("DELETE FROM portfolios WHERE id = $1 AND user_id = $2", portfolio_id, user_id)
    return r != "DELETE 0"


async def add_holding(pool: asyncpg.Pool, portfolio_id: int, user_id: int, ticker: str, shares: float, avg_cost: float, notes: Optional[str] = None) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT id FROM portfolios WHERE id = $1 AND user_id = $2", portfolio_id, user_id
    )
    if not row:
        return None
    r = await pool.fetchrow(
        "INSERT INTO portfolio_holdings (portfolio_id, ticker, shares, avg_cost, notes) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING *",
        portfolio_id, ticker.upper(), shares, avg_cost, notes,
    )
    return _serialize_row(r)


async def list_holdings(pool: asyncpg.Pool, portfolio_id: int, user_id: int) -> list[dict]:
    rows = await pool.fetch(
        "SELECT h.* FROM portfolio_holdings h "
        "JOIN portfolios p ON p.id = h.portfolio_id "
        "WHERE h.portfolio_id = $1 AND p.user_id = $2 "
        "ORDER BY h.ticker",
        portfolio_id, user_id,
    )
    return _serialize_rows(rows)


async def update_holding(pool: asyncpg.Pool, holding_id: int, portfolio_id: int, user_id: int, shares: float, avg_cost: float, notes: Optional[str] = None) -> Optional[dict]:
    row = await pool.fetchrow(
        "UPDATE portfolio_holdings h SET shares = $1, avg_cost = $2, notes = $3, updated_at = NOW() "
        "FROM portfolios p WHERE h.id = $4 AND h.portfolio_id = $5 AND p.id = $5 AND p.user_id = $6 "
        "RETURNING h.*",
        shares, avg_cost, notes, holding_id, portfolio_id, user_id,
    )
    return _serialize_row(row) if row else None


async def delete_holding(pool: asyncpg.Pool, holding_id: int, portfolio_id: int, user_id: int) -> bool:
    r = await pool.execute(
        "DELETE FROM portfolio_holdings h USING portfolios p "
        "WHERE h.id = $1 AND h.portfolio_id = $2 AND p.id = $2 AND p.user_id = $3",
        holding_id, portfolio_id, user_id,
    )
    return r != "DELETE 0"


# ---------------------------------------------------------------------------
# FUNDAMENTALS
# ---------------------------------------------------------------------------

async def upsert_fundamental(pool: asyncpg.Pool, data: dict) -> dict:
    row = await pool.fetchrow(
        """INSERT INTO fundamentals (ticker, pe_ratio, pb_ratio, ev_ebitda, roe, debt_to_equity,
            eps, eps_growth_pct, dividend_yield, dividend_payout_ratio, market_cap, sector, industry)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (ticker) DO UPDATE SET
            pe_ratio=EXCLUDED.pe_ratio, pb_ratio=EXCLUDED.pb_ratio,
            ev_ebitda=EXCLUDED.ev_ebitda, roe=EXCLUDED.roe,
            debt_to_equity=EXCLUDED.debt_to_equity, eps=EXCLUDED.eps,
            eps_growth_pct=EXCLUDED.eps_growth_pct,
            dividend_yield=EXCLUDED.dividend_yield,
            dividend_payout_ratio=EXCLUDED.dividend_payout_ratio,
            market_cap=EXCLUDED.market_cap, sector=EXCLUDED.sector,
            industry=EXCLUDED.industry, updated_at=NOW()
        RETURNING *""",
        data.get("ticker"), data.get("pe_ratio"), data.get("pb_ratio"),
        data.get("ev_ebitda"), data.get("roe"), data.get("debt_to_equity"),
        data.get("eps"), data.get("eps_growth_pct"), data.get("dividend_yield"),
        data.get("dividend_payout_ratio"), data.get("market_cap"),
        data.get("sector"), data.get("industry"),
    )
    return _serialize_row(row)


async def get_fundamental(pool: asyncpg.Pool, ticker: str) -> Optional[dict]:
    row = await pool.fetchrow("SELECT * FROM fundamentals WHERE ticker = $1", ticker.upper())
    return _serialize_row(row) if row else None


async def list_fundamentals(pool: asyncpg.Pool, where_clause: str, params: list) -> list[dict]:
    sql = f"SELECT * FROM fundamentals {where_clause} ORDER BY ticker"
    rows = await pool.fetch(sql, *params)
    return _serialize_rows(rows)


# ---------------------------------------------------------------------------
# PRICE HISTORY
# ---------------------------------------------------------------------------

async def upsert_price_row(pool: asyncpg.Pool, ticker: str, date: date, o: float, h: float, l: float, c: float, v: int) -> None:
    await pool.execute(
        "INSERT INTO price_history (ticker, date, open, high, low, close, volume) "
        "VALUES ($1,$2,$3,$4,$5,$6,$7) "
        "ON CONFLICT (ticker, date) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high, "
        "low=EXCLUDED.low, close=EXCLUDED.close, volume=EXCLUDED.volume",
        ticker.upper(), date, o, h, l, c, v,
    )


async def get_price_history(pool: asyncpg.Pool, ticker: str, start_date: date, end_date: date) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM price_history WHERE ticker = $1 AND date >= $2 AND date <= $3 ORDER BY date",
        ticker.upper(), start_date, end_date,
    )
    return _serialize_rows(rows)


# ---------------------------------------------------------------------------
# WATCHLIST & PRICE ALERTS
# ---------------------------------------------------------------------------

async def create_watchlist(pool: asyncpg.Pool, user_id: int, name: str, description: Optional[str] = None) -> dict:
    row = await pool.fetchrow(
        "INSERT INTO watchlists (user_id, name, description) VALUES ($1, $2, $3) RETURNING *",
        user_id, name, description,
    )
    return _serialize_row(row)


async def list_watchlists(pool: asyncpg.Pool, user_id: int) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM watchlists WHERE user_id = $1 ORDER BY created_at DESC", user_id
    )
    return _serialize_rows(rows)


async def get_watchlist(pool: asyncpg.Pool, watchlist_id: int, user_id: int) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT * FROM watchlists WHERE id = $1 AND user_id = $2", watchlist_id, user_id
    )
    return _serialize_row(row) if row else None


async def update_watchlist(pool: asyncpg.Pool, watchlist_id: int, user_id: int, name: str, description: Optional[str] = None) -> Optional[dict]:
    row = await pool.fetchrow(
        "UPDATE watchlists SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *",
        name, description, watchlist_id, user_id,
    )
    return _serialize_row(row) if row else None


async def delete_watchlist(pool: asyncpg.Pool, watchlist_id: int, user_id: int) -> bool:
    r = await pool.execute("DELETE FROM watchlists WHERE id = $1 AND user_id = $2", watchlist_id, user_id)
    return r != "DELETE 0"


async def add_watchlist_item(pool: asyncpg.Pool, watchlist_id: int, user_id: int, ticker: str, notes: Optional[str] = None) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT id FROM watchlists WHERE id = $1 AND user_id = $2", watchlist_id, user_id
    )
    if not row:
        return None
    r = await pool.fetchrow(
        "INSERT INTO watchlist_items (watchlist_id, ticker, notes) VALUES ($1, $2, $3) "
        "ON CONFLICT (watchlist_id, ticker) DO UPDATE SET notes = EXCLUDED.notes RETURNING *",
        watchlist_id, ticker.upper(), notes,
    )
    return _serialize_row(r)


async def list_watchlist_items(pool: asyncpg.Pool, watchlist_id: int, user_id: int) -> list[dict]:
    rows = await pool.fetch(
        "SELECT i.* FROM watchlist_items i JOIN watchlists w ON w.id = i.watchlist_id "
        "WHERE i.watchlist_id = $1 AND w.user_id = $2 ORDER BY i.added_at",
        watchlist_id, user_id,
    )
    return _serialize_rows(rows)


async def remove_watchlist_item(pool: asyncpg.Pool, item_id: int, watchlist_id: int, user_id: int) -> bool:
    r = await pool.execute(
        "DELETE FROM watchlist_items i USING watchlists w "
        "WHERE i.id = $1 AND i.watchlist_id = $2 AND w.id = $2 AND w.user_id = $3",
        item_id, watchlist_id, user_id,
    )
    return r != "DELETE 0"


async def create_price_alert(pool: asyncpg.Pool, user_id: int, ticker: str, alert_type: str, threshold_price: float, delivery_method: str = "db") -> dict:
    row = await pool.fetchrow(
        "INSERT INTO price_alerts (user_id, ticker, alert_type, threshold_price, delivery_method) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING *",
        user_id, ticker.upper(), alert_type, threshold_price, delivery_method,
    )
    return _serialize_row(row)


async def list_price_alerts(pool: asyncpg.Pool, user_id: Optional[int] = None, ticker: Optional[str] = None) -> list[dict]:
    clauses = ["1=1"]
    params: list = []
    if user_id is not None:
        clauses.append(f"user_id = ${len(params) + 1}")
        params.append(user_id)
    if ticker:
        clauses.append(f"ticker = ${len(params) + 1}")
        params.append(ticker.upper())
    where = " AND ".join(clauses)
    rows = await pool.fetch(
        f"SELECT * FROM price_alerts WHERE {where} ORDER BY created_at DESC", *params
    )
    return _serialize_rows(rows)


async def get_active_alerts_by_ticker(pool: asyncpg.Pool, ticker: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM price_alerts WHERE is_active = TRUE AND is_triggered = FALSE AND ticker = $1",
        ticker.upper(),
    )
    return _serialize_rows(rows)


async def trigger_alert(pool: asyncpg.Pool, alert_id: int) -> None:
    await pool.execute(
        "UPDATE price_alerts SET is_triggered = TRUE, triggered_at = NOW() WHERE id = $1", alert_id
    )


async def delete_price_alert(pool: asyncpg.Pool, alert_id: int, user_id: int) -> bool:
    r = await pool.execute(
        "DELETE FROM price_alerts WHERE id = $1 AND user_id = $2", alert_id, user_id
    )
    return r != "DELETE 0"
