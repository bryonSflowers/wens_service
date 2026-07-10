"""
Earnings calendar router — pulls earnings data from yfinance.
"""
import asyncio
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from yfinance_cache import fetch_yfinance

import db as db_service

router = APIRouter(prefix="/earnings", tags=["Earnings"])


@router.get("/{ticker}")
async def get_earnings(ticker: str):
    """Get earnings calendar for a ticker from yfinance."""
    pool = await db_service.get_pool()

    cached = await pool.fetch(
        "SELECT * FROM earnings WHERE ticker = $1 ORDER BY report_date DESC NULLS LAST LIMIT 12",
        ticker.upper(),
    )
    if cached:
        return db_service._serialize_rows(cached)

    try:
        loop = asyncio.get_event_loop()
        tk = __import__("yfinance").Ticker(ticker)
        cal = await loop.run_in_executor(None, lambda: tk.calendar)
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch earnings for {ticker}: {e}")

    if not cal:
        raise HTTPException(404, f"No earnings data for {ticker}")

    result = []
    for idx in range(len(cal) if hasattr(cal, '__len__') else 0):
        try:
            row = cal.iloc[idx] if hasattr(cal, 'iloc') else cal
        except Exception:
            continue

    return {"ticker": ticker.upper(), "calendar": cal.to_dict() if hasattr(cal, 'to_dict') else str(cal)}


@router.get("/{ticker}/upcoming")
async def get_upcoming_earnings(ticker: str):
    """Get upcoming earnings date for a ticker."""
    loop = asyncio.get_event_loop()
    tk = __import__("yfinance").Ticker(ticker)
    cal = await loop.run_in_executor(None, lambda: tk.calendar)
    if cal is None:
        raise HTTPException(404, f"No calendar data for {ticker}")
    try:
        data = cal.to_dict() if hasattr(cal, 'to_dict') else {}
    except Exception:
        data = {}
    # Also try to get from info
    info = await fetch_yfinance(ticker, "info")
    earnings_date = info.get("earningsDate") or info.get("earningsTimestamp")
    return {
        "ticker": ticker.upper(),
        "earnings_date": earnings_date,
        "calendar": data,
    }
