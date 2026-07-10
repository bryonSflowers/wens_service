import yfinance as yf
from fastapi import APIRouter, HTTPException

import db as db_service
from schemas.fundamentals import FundamentalResponse, FundamentalRefreshResponse

router = APIRouter(prefix="/fundamentals", tags=["Fundamentals"])


def _fetch_fundamentals(ticker: str) -> dict:
    tk = yf.Ticker(ticker)
    info = tk.info or {}
    return {
        "ticker": ticker.upper(),
        "pe_ratio": info.get("trailingPE") or info.get("forwardPE"),
        "pb_ratio": info.get("priceToBook"),
        "ev_ebitda": info.get("enterpriseToEbitda") or info.get("enterpriseValueToEbitda"),
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


def _convert(obj: dict) -> dict:
    result = {}
    for k, v in obj.items():
        if v is not None:
            try:
                result[k] = float(v) if not isinstance(v, str) else v
            except (ValueError, TypeError):
                result[k] = v
        else:
            result[k] = None
    return result


@router.get("/{ticker}", response_model=FundamentalResponse)
async def get_fundamentals(ticker: str):
    pool = await db_service.get_pool()
    cached = await db_service.get_fundamental(pool, ticker)
    if cached:
        return cached
    raw = _fetch_fundamentals(ticker)
    if not raw.get("pe_ratio") and not raw.get("market_cap"):
        raise HTTPException(404, f"Could not fetch fundamentals for {ticker.upper()}")
    data = _convert(raw)
    saved = await db_service.upsert_fundamental(pool, data)
    return saved


@router.post("/{ticker}/refresh", response_model=FundamentalRefreshResponse)
async def refresh_fundamentals(ticker: str):
    pool = await db_service.get_pool()
    raw = _fetch_fundamentals(ticker)
    if not raw.get("pe_ratio") and not raw.get("market_cap"):
        raise HTTPException(404, f"Could not fetch fundamentals for {ticker.upper()}")
    data = _convert(raw)
    saved = await db_service.upsert_fundamental(pool, data)
    return FundamentalRefreshResponse(
        ticker=ticker.upper(), status="refreshed", data=saved,
    )
