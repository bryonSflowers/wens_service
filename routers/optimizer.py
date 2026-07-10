"""
Portfolio Optimizer — Efficient Frontier via scipy (Markowitz).
"""
import asyncio
import math
from datetime import date, timedelta
from typing import Optional

import numpy as np
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from scipy.optimize import minimize

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


def _portfolio_stats(weights: np.ndarray, mean: np.ndarray, cov: np.ndarray) -> tuple:
    ret = np.sum(mean * weights) * 252
    vol = np.sqrt(np.dot(weights.T, np.dot(cov, weights))) * math.sqrt(252)
    return ret, vol


def _neg_sharpe(weights: np.ndarray, mean: np.ndarray, cov: np.ndarray, rf: float = 0.02) -> float:
    ret, vol = _portfolio_stats(weights, mean, cov)
    return -(ret - rf) / vol if vol > 0 else 0


@router.get("/optimize")
async def optimize_portfolio(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. '3045.TW,2330.TW,2412.TW'"),
    years: int = Query(3, ge=1, le=10),
    risk_free: float = Query(0.02, ge=0, le=0.15),
    points: int = Query(50, ge=20, le=200),
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) < 2:
        raise HTTPException(400, "Provide at least 2 tickers")
    if len(ticker_list) > 10:
        raise HTTPException(400, "Maximum 10 tickers")

    loop = asyncio.get_event_loop()
    end = date.today()
    start = end - timedelta(days=int(years * 365.25))

    def _fetch():
        data = yf.download(ticker_list, start=start.isoformat(), end=end.isoformat(), interval="1d", auto_adjust=True, progress=False)
        if data.empty:
            raise HTTPException(400, "No price data returned")
        closes = data["Close"] if "Close" in data.columns else data.xs("Close", axis=1, level=0)
        return closes.dropna()

    closes = await loop.run_in_executor(None, _fetch)
    prices = closes.values.T  # shape (n_tickers, n_days)
    n = len(ticker_list)

    returns = np.diff(prices) / prices[:, :-1]  # daily returns
    mean = np.mean(returns, axis=1)
    cov = np.cov(returns)

    n_portfolios = points
    targets = np.linspace(mean.min() * 252, mean.max() * 252, n_portfolios)

    # Max Sharpe
    init = np.array([1.0 / n] * n)
    bounds = [(0.0, 1.0)] * n
    constraints = {"type": "eq", "fun": lambda w: np.sum(w) - 1.0}

    opt = minimize(_neg_sharpe, init, args=(mean, cov, risk_free), method="SLSQP", bounds=bounds, constraints=constraints)
    max_sharpe_w = opt.x if opt.success else init
    ms_ret, ms_vol = _portfolio_stats(max_sharpe_w, mean, cov)

    # Min variance
    opt_min = minimize(lambda w: _portfolio_stats(w, mean, cov)[1], init, method="SLSQP", bounds=bounds, constraints=constraints)
    min_var_w = opt_min.x if opt_min.success else init
    mv_ret, mv_vol = _portfolio_stats(min_var_w, mean, cov)

    # Efficient frontier
    frontier = []
    for tr in targets:
        cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0},
                {"type": "eq", "fun": lambda w, t=tr: np.sum(w * mean) * 252 - t}]
        res = minimize(lambda w: _portfolio_stats(w, mean, cov)[1], init, method="SLSQP", bounds=bounds, constraints=cons)
        if res.success:
            f_ret, f_vol = _portfolio_stats(res.x, mean, cov)
            frontier.append({"ret": round(f_ret * 100, 2), "vol": round(f_vol * 100, 2)})

    # Individual assets
    assets = []
    for i, t in enumerate(ticker_list):
        ann_ret = mean[i] * 252 * 100
        ann_vol = np.std(returns[i]) * math.sqrt(252) * 100
        sharpe = (ann_ret - risk_free * 100) / ann_vol if ann_vol > 0 else 0
        assets.append({"ticker": t, "annReturn": round(ann_ret, 2), "annVol": round(ann_vol, 2), "sharpe": round(sharpe, 3)})

    return {
        "tickers": ticker_list,
        "maxSharpe": {
            "weights": {ticker_list[i]: round(float(w), 4) for i, w in enumerate(max_sharpe_w)},
            "annReturn": round(ms_ret * 100, 2),
            "annVol": round(ms_vol * 100, 2),
            "sharpe": round((ms_ret - risk_free) / ms_vol if ms_vol > 0 else 0, 3),
        },
        "minVariance": {
            "weights": {ticker_list[i]: round(float(w), 4) for i, w in enumerate(min_var_w)},
            "annReturn": round(mv_ret * 100, 2),
            "annVol": round(mv_vol * 100, 2),
        },
        "frontier": frontier,
        "assets": assets,
    }
