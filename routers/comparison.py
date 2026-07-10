"""
Comparison engine — side-by-side fundamentals, risk, and metrics for multiple tickers.
"""
import asyncio
from datetime import date, timedelta
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query

import db as db_service
from yfinance_cache import fetch_yfinance

router = APIRouter(prefix="/compare", tags=["Compare"])


@router.get("")
async def compare_tickers(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. '3045.TW,2330.TW'"),
):
    """Compare fundamentals across multiple tickers."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) < 2:
        raise HTTPException(400, "Provide at least 2 tickers to compare")
    if len(ticker_list) > 6:
        raise HTTPException(400, "Maximum 6 tickers per comparison")

    pool = await db_service.get_pool()
    results = []
    errors = []

    for ticker in ticker_list:
        try:
            fund = await db_service.get_fundamental(pool, ticker)
            if not fund:
                info = await fetch_yfinance(ticker, "info")
                fund = {
                    "ticker": ticker,
                    "pe_ratio": info.get("trailingPE") or info.get("forwardPE"),
                    "pb_ratio": info.get("priceToBook"),
                    "ev_ebitda": info.get("enterpriseToEbitda"),
                    "roe": info.get("returnOnEquity"),
                    "debt_to_equity": info.get("debtToEquity"),
                    "eps": info.get("trailingEps") or info.get("forwardEps"),
                    "eps_growth_pct": info.get("earningsGrowth"),
                    "dividend_yield": info.get("dividendYield"),
                    "dividend_payout_ratio": info.get("payoutRatio"),
                    "market_cap": info.get("marketCap"),
                    "sector": info.get("sector"),
                    "industry": info.get("industry"),
                }
            results.append(fund)
        except Exception as e:
            errors.append({"ticker": ticker, "error": str(e)})

    return {"items": results, "errors": errors, "count": len(results)}


@router.get("/full")
async def compare_full(
    tickers: str = Query(..., description="Comma-separated tickers"),
):
    """Full comparison: fundamentals + risk + recent performance."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) < 2:
        raise HTTPException(400, "Provide at least 2 tickers")
    if len(ticker_list) > 6:
        raise HTTPException(400, "Maximum 6 tickers")

    pool = await db_service.get_pool()
    results = []
    errors = []

    for ticker in ticker_list:
        try:
            fund = await db_service.get_fundamental(pool, ticker)
            if not fund:
                info = await fetch_yfinance(ticker, "info")
                fund = {
                    "ticker": ticker,
                    "pe_ratio": info.get("trailingPE") or info.get("forwardPE"),
                    "pb_ratio": info.get("priceToBook"),
                    "ev_ebitda": info.get("enterpriseToEbitda"),
                    "roe": info.get("returnOnEquity"),
                    "debt_to_equity": info.get("debtToEquity"),
                    "eps": info.get("trailingEps") or info.get("forwardEps"),
                    "eps_growth_pct": info.get("earningsGrowth"),
                    "dividend_yield": info.get("dividendYield"),
                    "market_cap": info.get("marketCap"),
                    "sector": info.get("sector"),
                    "industry": info.get("industry"),
                }

            end = date.today()
            start = end - timedelta(days=365)
            rows = await db_service.get_price_history(pool, ticker, start, end)
            perf = {}
            if len(rows) >= 20:
                closes = [float(r["close"]) for r in rows]
                perf["price_change_1y_pct"] = round((closes[-1] - closes[0]) / closes[0] * 100, 2)
                perf["current_price"] = closes[-1]
                returns = [closes[i] / closes[i - 1] - 1 for i in range(1, len(closes))]
                if returns:
                    perf["volatility_pct"] = round(float(np.std(returns, ddof=1) * (252 ** 0.5) * 100), 2)
                    avg_ret = float(np.mean(returns))
                    std_ret = float(np.std(returns, ddof=1))
                    perf["sharpe"] = round(avg_ret / std_ret * (252 ** 0.5), 2) if std_ret > 0 else 0
                if len(closes) >= 252:
                    high_idx = max(range(len(closes) - 252, len(closes)), key=lambda i: closes[i])
                    low_idx = min(range(high_idx, len(closes)), key=lambda i: closes[i])
                    peak = closes[high_idx]
                    trough = closes[low_idx]
                    perf["max_drawdown_pct"] = round((trough - peak) / peak * 100, 2)

            fund["performance"] = perf
            results.append(fund)
        except Exception as e:
            errors.append({"ticker": ticker, "error": str(e)})

    return {"items": results, "errors": errors, "count": len(results)}
