import math
from datetime import date, timedelta
from typing import Optional

import numpy as np
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

from schemas.risk import (
    VolatilityResponse, SharpeResponse, MaxDrawdownResponse,
    VaRResponse, BetaResponse, RiskAllResponse,
)

router = APIRouter(prefix="/risk", tags=["Risk Analytics"])


def _fetch_returns(ticker: str, days: int = 365) -> np.ndarray:
    end = date.today()
    start = end - timedelta(days=days + 30)
    tk = yf.Ticker(ticker)
    hist = tk.history(start=start.isoformat(), end=end.isoformat(), interval="1d")
    if hist.empty or len(hist) < 10:
        raise HTTPException(400, f"Insufficient price data for {ticker}")
    closes = hist["Close"].values.astype(float)
    returns = np.diff(closes) / closes[:-1]
    return returns


def _annualized_vol(returns: np.ndarray) -> float:
    return float(np.std(returns, ddof=1) * math.sqrt(252))


def _annualized_return(returns: np.ndarray) -> float:
    total = float(np.prod(1 + returns))
    n = len(returns)
    return (total ** (252 / n)) - 1 if n > 0 else 0.0


@router.get("/{ticker}/volatility", response_model=VolatilityResponse)
async def volatility(ticker: str, days: int = Query(252, ge=20, le=756)):
    returns = _fetch_returns(ticker, days)
    vol = _annualized_vol(returns) * 100
    return VolatilityResponse(ticker=ticker.upper(), days=days, annualized_volatility_pct=round(vol, 2))


@router.get("/{ticker}/sharpe", response_model=SharpeResponse)
async def sharpe(ticker: str, risk_free_rate: float = Query(2.0, ge=0, le=20), days: int = Query(252, ge=20, le=756)):
    returns = _fetch_returns(ticker, days)
    ann_ret = _annualized_return(returns) * 100
    ann_vol = _annualized_vol(returns) * 100
    excess = ann_ret - risk_free_rate
    sr = excess / ann_vol if ann_vol > 0 else 0.0
    return SharpeResponse(
        ticker=ticker.upper(), sharpe_ratio=round(sr, 4),
        risk_free_rate_pct=risk_free_rate,
        annualized_return_pct=round(ann_ret, 2),
        annualized_volatility_pct=round(ann_vol, 2),
    )


@router.get("/{ticker}/max-drawdown", response_model=MaxDrawdownResponse)
async def max_drawdown(ticker: str, days: int = Query(756, ge=20, le=1825)):
    end = date.today()
    start = end - timedelta(days=days + 30)
    tk = yf.Ticker(ticker)
    hist = tk.history(start=start.isoformat(), end=end.isoformat(), interval="1d")
    if hist.empty:
        raise HTTPException(400, f"No price data for {ticker}")
    closes = hist["Close"].values.astype(float)
    peak = np.maximum.accumulate(closes)
    drawdowns = (closes - peak) / peak
    idx = int(np.argmin(drawdowns))
    mdd = float(drawdowns[idx]) * 100
    peak_idx = int(np.argmax(peak[:idx+1])) if idx > 0 else 0
    peak_date = hist.index[peak_idx].strftime("%Y-%m-%d") if not hist.empty else None
    trough_date = hist.index[idx].strftime("%Y-%m-%d") if not hist.empty else None
    return MaxDrawdownResponse(
        ticker=ticker.upper(), max_drawdown_pct=round(mdd, 2),
        peak_date=peak_date, trough_date=trough_date,
    )


@router.get("/{ticker}/var", response_model=VaRResponse)
async def value_at_risk(ticker: str, confidence: float = Query(0.95, ge=0.9, le=0.99), days: int = Query(252, ge=20, le=756)):
    returns = _fetch_returns(ticker, days)
    var_daily = float(np.percentile(returns, (1 - confidence) * 100)) * 100
    var_weekly = var_daily * math.sqrt(5)
    var_monthly = var_daily * math.sqrt(21)
    return VaRResponse(
        ticker=ticker.upper(), confidence=confidence,
        var_daily_pct=round(var_daily, 2),
        var_weekly_pct=round(var_weekly, 2),
        var_monthly_pct=round(var_monthly, 2),
    )


@router.get("/{ticker}/beta", response_model=BetaResponse)
async def beta(
    ticker: str,
    index_ticker: str = Query("0050.TW"),
    days: int = Query(252, ge=20, le=756),
):
    stock_returns = _fetch_returns(ticker, days)
    index_returns = _fetch_returns(index_ticker, days)
    min_len = min(len(stock_returns), len(index_returns))
    stock_returns = stock_returns[-min_len:]
    index_returns = index_returns[-min_len:]
    cov = float(np.cov(stock_returns, index_returns, ddof=1)[0, 1])
    var_index = float(np.var(index_returns, ddof=1))
    b = cov / var_index if var_index > 0 else 0.0
    corr = float(np.corrcoef(stock_returns, index_returns)[0, 1])
    return BetaResponse(
        ticker=ticker.upper(), index_ticker=index_ticker.upper(),
        beta=round(b, 4), correlation=round(corr, 4),
    )


@router.get("/{ticker}/all", response_model=RiskAllResponse)
async def all_risk_metrics(
    ticker: str,
    index_ticker: str = Query("0050.TW"),
    risk_free_rate: float = Query(2.0),
    days: int = Query(252, ge=20, le=756),
):
    try:
        returns = _fetch_returns(ticker, days)
    except HTTPException:
        return RiskAllResponse(ticker=ticker.upper())
    ann_vol = _annualized_vol(returns) * 100
    ann_ret = _annualized_return(returns) * 100
    excess = ann_ret - risk_free_rate
    sr = excess / ann_vol if ann_vol > 0 else 0.0
    end = date.today()
    start = end - timedelta(days=days + 30)
    tk = yf.Ticker(ticker)
    hist = tk.history(start=start.isoformat(), end=end.isoformat(), interval="1d")
    closes = hist["Close"].values.astype(float)
    peak = np.maximum.accumulate(closes)
    drawdowns = (closes - peak) / peak
    mdd = float(np.min(drawdowns)) * 100
    var_95 = float(np.percentile(returns, 5)) * 100
    try:
        idx_returns = _fetch_returns(index_ticker, days)
        min_len = min(len(returns), len(idx_returns))
        cov = float(np.cov(returns[-min_len:], idx_returns[-min_len:], ddof=1)[0, 1])
        var_idx = float(np.var(idx_returns[-min_len:], ddof=1))
        b = cov / var_idx if var_idx > 0 else None
    except HTTPException:
        b = None
    return RiskAllResponse(
        ticker=ticker.upper(),
        annualized_volatility_pct=round(ann_vol, 2),
        sharpe_ratio=round(sr, 4),
        max_drawdown_pct=round(mdd, 2),
        var_95_daily_pct=round(var_95, 2),
        beta_vs_index=round(b, 4) if b is not None else None,
        index_ticker=index_ticker.upper() if b is not None else None,
    )
