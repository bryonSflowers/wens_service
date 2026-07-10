from fastapi import APIRouter, HTTPException, Query
from typing import Optional

import db as db_service
from schemas.screener import ScreenerQuery, ScreenerResponse

router = APIRouter(prefix="/screener", tags=["Stock Screener"])

ALLOWED_SORT_COLUMNS = {
    "pe_ratio", "pb_ratio", "ev_ebitda", "roe", "debt_to_equity",
    "eps", "eps_growth_pct", "dividend_yield", "market_cap",
}


@router.get("", response_model=ScreenerResponse)
async def screen_stocks(
    pe_ratio_lt: Optional[float] = Query(None),
    pe_ratio_gt: Optional[float] = Query(None),
    pb_ratio_lt: Optional[float] = Query(None),
    pb_ratio_gt: Optional[float] = Query(None),
    dividend_yield_gt: Optional[float] = Query(None),
    dividend_yield_lt: Optional[float] = Query(None),
    market_cap_gt: Optional[float] = Query(None),
    market_cap_lt: Optional[float] = Query(None),
    sector: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    roe_gt: Optional[float] = Query(None),
    eps_growth_gt: Optional[float] = Query(None),
    debt_to_equity_lt: Optional[float] = Query(None),
    ev_ebitda_lt: Optional[float] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_dir: str = Query("desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    clauses: list[str] = []
    params: list = []
    param_idx = 0

    filters = [
        ("pe_ratio", pe_ratio_lt, "<="),
        ("pe_ratio", pe_ratio_gt, ">="),
        ("pb_ratio", pb_ratio_lt, "<="),
        ("pb_ratio", pb_ratio_gt, ">="),
        ("dividend_yield", dividend_yield_gt, ">="),
        ("dividend_yield", dividend_yield_lt, "<="),
        ("market_cap", market_cap_gt, ">="),
        ("market_cap", market_cap_lt, "<="),
        ("roe", roe_gt, ">="),
        ("eps_growth_pct", eps_growth_gt, ">="),
        ("debt_to_equity", debt_to_equity_lt, "<="),
        ("ev_ebitda", ev_ebitda_lt, "<="),
    ]
    for col, val, op in filters:
        if val is not None:
            param_idx += 1
            clauses.append(f"{col} IS NOT NULL AND {col} {op} ${param_idx}")
            params.append(val)

    if sector:
        param_idx += 1
        clauses.append(f"LOWER(sector) = LOWER(${param_idx})")
        params.append(sector)
    if industry:
        param_idx += 1
        clauses.append(f"LOWER(industry) = LOWER(${param_idx})")
        params.append(industry)

    where_clause = "WHERE " + " AND ".join(clauses) if clauses else ""

    if sort_by and sort_by in ALLOWED_SORT_COLUMNS:
        dir_sql = "DESC NULLS LAST" if sort_dir.lower() == "desc" else "ASC NULLS LAST"
        order_clause = f"ORDER BY {sort_by} {dir_sql}, ticker"
    else:
        order_clause = "ORDER BY ticker"

    pool = await db_service.get_pool()

    count_sql = f"SELECT COUNT(*) FROM fundamentals {where_clause}"
    total = await pool.fetchval(count_sql, *params)

    data_sql = f"SELECT * FROM fundamentals {where_clause} {order_clause} LIMIT ${param_idx + 1} OFFSET ${param_idx + 2}"
    rows = await pool.fetch(data_sql, *params, limit, offset)

    items = [dict(r) for r in rows]
    for item in items:
        for k, v in list(item.items()):
            if v is None:
                item[k] = None
            else:
                try:
                    item[k] = float(v)
                except (ValueError, TypeError):
                    pass

    return ScreenerResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/sectors")
async def list_sectors():
    pool = await db_service.get_pool()
    rows = await pool.fetch(
        "SELECT DISTINCT sector FROM fundamentals WHERE sector IS NOT NULL ORDER BY sector"
    )
    return [r["sector"] for r in rows]


@router.get("/industries")
async def list_industries(sector: Optional[str] = Query(None)):
    pool = await db_service.get_pool()
    if sector:
        rows = await pool.fetch(
            "SELECT DISTINCT industry FROM fundamentals WHERE industry IS NOT NULL AND LOWER(sector) = LOWER($1) ORDER BY industry",
            sector,
        )
    else:
        rows = await pool.fetch(
            "SELECT DISTINCT industry FROM fundamentals WHERE industry IS NOT NULL ORDER BY industry"
        )
    return [r["industry"] for r in rows]
