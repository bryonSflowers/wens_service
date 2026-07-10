import asyncio
from datetime import date, timedelta

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

import db as db_service
from schemas.chart import (
    OHLCVItem, OHLCVResponse,
    MAItem, MAResponse,
    VolumeProfileItem, VolumeProfileResponse,
)

router = APIRouter(prefix="/chart", tags=["Chart / Time-Series"])


@router.post("/{ticker}/sync")
async def sync_price_history(ticker: str, period: str = Query("1y")):
    pool = await db_service.get_pool()
    try:
        loop = asyncio.get_event_loop()
        tk = yf.Ticker(ticker)
        hist = await loop.run_in_executor(None, lambda: tk.history(period=period, interval="1d"))
    except Exception as e:
        raise HTTPException(400, str(e))
    if hist.empty:
        raise HTTPException(404, f"No price data for {ticker}")
    count = 0
    for idx, row in hist.iterrows():
        dt = idx.date() if hasattr(idx, "date") else idx
        await db_service.upsert_price_row(
            pool, ticker, dt,
            float(row["Open"]), float(row["High"]),
            float(row["Low"]), float(row["Close"]),
            int(row["Volume"]),
        )
        count += 1
    return {"synced": True, "ticker": ticker.upper(), "rows": count}


@router.get("/{ticker}/ohlcv", response_model=OHLCVResponse)
async def get_ohlcv(
    ticker: str,
    days: int = Query(365, ge=1, le=1825, description="Days to look back"),
):
    pool = await db_service.get_pool()
    end = date.today()
    start = end - timedelta(days=days)
    rows = await db_service.get_price_history(pool, ticker, start, end)
    if not rows:
        raise HTTPException(404, f"No cached price data for {ticker}. POST /chart/{ticker}/sync first.")
    items = [
        OHLCVItem(
            time=r["date"] if isinstance(r["date"], str) else r["date"].isoformat(),
            open=float(r["open"]), high=float(r["high"]),
            low=float(r["low"]), close=float(r["close"]),
            volume=int(r["volume"]),
        )
        for r in rows
    ]
    return OHLCVResponse(ticker=ticker.upper(), interval="1d", items=items)


@router.get("/{ticker}/ma", response_model=list[MAResponse])
async def get_moving_averages(
    ticker: str,
    windows: str = Query("20,50,200"),
    days: int = Query(365, ge=1, le=1825),
):
    pool = await db_service.get_pool()
    end = date.today()
    start = end - timedelta(days=days)
    rows = await db_service.get_price_history(pool, ticker, start, end)
    if not rows:
        raise HTTPException(404, f"No cached price data for {ticker}.")
    closes = [float(r["close"]) for r in rows]
    dates = [r["date"] if isinstance(r["date"], str) else r["date"].isoformat() for r in rows]
    results = []
    for w_str in windows.split(","):
        w = int(w_str.strip())
        if len(closes) < w:
            continue
        items = []
        for i in range(w - 1, len(closes)):
            ma = sum(closes[i - w + 1:i + 1]) / w
            items.append(MAItem(time=dates[i], value=round(ma, 2)))
        results.append(MAResponse(ticker=ticker.upper(), window=w, items=items))
    return results


@router.get("/{ticker}/volume-profile", response_model=VolumeProfileResponse)
async def get_volume_profile(ticker: str, bins: int = Query(20, ge=5, le=100), days: int = Query(90, ge=1, le=1825)):
    pool = await db_service.get_pool()
    end = date.today()
    start = end - timedelta(days=days)
    rows = await db_service.get_price_history(pool, ticker, start, end)
    if not rows:
        raise HTTPException(404, f"No cached price data for {ticker}.")
    closes = [float(r["close"]) for r in rows]
    volumes = [int(r["volume"]) for r in rows]
    min_p, max_p = min(closes), max(closes)
    bin_width = (max_p - min_p) / bins if max_p > min_p else 1
    buckets = [0.0] * bins
    for c, v in zip(closes, volumes):
        idx = min(int((c - min_p) / bin_width), bins - 1) if bin_width > 0 else 0
        buckets[idx] += v
    items = [
        VolumeProfileItem(price=round(min_p + i * bin_width + bin_width / 2, 2), volume=int(buckets[i]))
        for i in range(bins)
    ]
    return VolumeProfileResponse(ticker=ticker.upper(), items=items)
