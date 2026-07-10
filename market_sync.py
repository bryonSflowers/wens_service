"""
Fetches Taiwan Mobile (3045.TW) stock performance and published financial
metadata for a given month using yfinance, then upserts into monthly_reports.
"""
import asyncio
import calendar
import json
import logging
from datetime import date, timedelta
from typing import Any

import yfinance as yf 

DEFAULT_TICKER = "3045.TW"
log = logging.getLogger(__name__)


def _parse_news(raw: list) -> list[dict]:
    out = []
    for n in raw[:5]:
        # yfinance >=0.2.50 wraps data under a "content" key
        if "content" in n:
            c = n["content"]
            out.append({
                "title": c.get("title"),
                "publisher": c.get("provider", {}).get("displayName"),
                "url": c.get("canonicalUrl", {}).get("url"),
                "published_at": c.get("pubDate"),
            })
        else:
            out.append({
                "title": n.get("title"),
                "publisher": n.get("publisher"),
                "url": n.get("link"),
                "published_at": n.get("providerPublishTime"),
            })
    return out


def _fetch_sync(ticker: str, year: int, month: int) -> dict[str, Any]:
    """Synchronous yfinance calls — always run via run_in_executor."""
    tk = yf.Ticker(ticker)

    start = date(year, month, 1)
    end = date(year, month, calendar.monthrange(year, month)[1]) + timedelta(days=1)

    hist = tk.history(start=start.isoformat(), end=end.isoformat(), interval="1d")

    data: dict[str, Any] = {"ticker": ticker, "year": year, "month": month}

    if not hist.empty:
        data.update({
            "open":            round(float(hist["Open"].iloc[0]), 2),
            "close":           round(float(hist["Close"].iloc[-1]), 2),
            "month_high":      round(float(hist["High"].max()), 2),
            "month_low":       round(float(hist["Low"].min()), 2),
            "avg_close":       round(float(hist["Close"].mean()), 2),
            "avg_daily_volume": int(hist["Volume"].mean()),
            "price_change_pct": round(
                (hist["Close"].iloc[-1] - hist["Open"].iloc[0])
                / hist["Open"].iloc[0] * 100, 2
            ),
            "trading_days": len(hist),
        })

    info = tk.info or {}
    data["ticker"] = ticker
    data["company_snapshot"] = {
        k: info.get(k) for k in (
            "marketCap", "trailingPE", "forwardPE", "priceToBook",
            "dividendYield", "beta", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
            "averageVolume", "currency", "totalRevenue", "netIncomeToCommon",
            "operatingMargins", "profitMargins",
        )
    }

    data["recent_news"] = _parse_news(tk.news or [])

    return data


async def sync_month(pool, year: int, month: int, ticker: str = DEFAULT_TICKER) -> dict[str, Any]:
    """Fetch market data and merge it into monthly_reports.report_data."""
    loop = asyncio.get_event_loop()
    market_data = await loop.run_in_executor(None, _fetch_sync, ticker, year, month)

    payload = json.dumps({"market_data": market_data, "ticker": ticker})

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO monthly_reports (ticker, year, month, report_data)
            VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT (year, month, ticker) DO UPDATE
                SET report_data =
                    COALESCE(monthly_reports.report_data, '{}'::jsonb) || $4::jsonb
            """,
            ticker, year, month, payload,
        )

    log.info("Market data synced for %s %d-%02d", ticker, year, month)
    return market_data
