"""
Backtesting router — simulates buy-hold and signal-based strategies.
"""
import asyncio
import json
import math
from datetime import date, timedelta
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query

import db as db_service
from middleware import get_current_user

router = APIRouter(prefix="/backtest", tags=["Backtesting"])


@router.get("/{ticker}")
async def backtest(
    ticker: str,
    strategy: str = Query("buy_hold", description="buy_hold or sma_cross"),
    start: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="YYYY-MM-DD"),
    initial_capital: float = Query(10000, ge=1000),
    short_window: int = Query(20, ge=2, le=100, description="SMA short window for sma_cross"),
    long_window: int = Query(50, ge=5, le=200, description="SMA long window for sma_cross"),
    current_user: dict = Depends(get_current_user),
):
    pool = await db_service.get_pool()
    end_date = date.today()
    start_date = end_date - timedelta(days=365 * 3)

    rows = await db_service.get_price_history(pool, ticker, start_date, end_date)
    if len(rows) < 50:
        raise HTTPException(400, f"Insufficient price history for {ticker} (need 50+ days)")

    closes = [float(r["close"]) for r in rows]
    dates = [r["date"] if isinstance(r["date"], str) else r["date"].isoformat()[:10] for r in rows]

    if strategy == "sma_cross":
        trades, equity_curve = _sma_cross_strategy(closes, dates, initial_capital, short_window, long_window)
    else:
        trades, equity_curve = _buy_hold_strategy(closes, dates, initial_capital)

    total_return = ((equity_curve[-1] - initial_capital) / initial_capital) * 100
    years = len(closes) / 252
    ann_return = ((1 + total_return / 100) ** (1 / years) - 1) * 100 if years > 0 else 0
    peak = np.maximum.accumulate(equity_curve)
    drawdown = (equity_curve - peak) / peak
    max_dd = float(np.min(drawdown)) * 100
    returns = np.diff(equity_curve) / equity_curve[:-1]
    sharpe = float(np.mean(returns) / np.std(returns, ddof=1) * math.sqrt(252)) if len(returns) > 0 and np.std(returns) > 0 else 0

    params = {
        "strategy": strategy,
        "initial_capital": initial_capital,
        "short_window": short_window if strategy == "sma_cross" else None,
        "long_window": long_window if strategy == "sma_cross" else None,
    }

    await pool.execute(
        "INSERT INTO backtest_results (user_id, ticker, strategy, total_return_pct, annualized_return_pct, max_drawdown_pct, sharpe_ratio, parameters) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
        current_user["id"], ticker.upper(), strategy,
        round(total_return, 4), round(ann_return, 4), round(max_dd, 4), round(sharpe, 4),
        json.dumps(params),
    )

    return {
        "ticker": ticker.upper(),
        "strategy": strategy,
        "initial_capital": initial_capital,
        "total_return_pct": round(total_return, 2),
        "annualized_return_pct": round(ann_return, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 4),
        "final_equity": round(equity_curve[-1], 2),
        "trades": trades[-20:],
        "equity_curve": [{"date": dates[i], "value": round(equity_curve[i], 2)} for i in range(0, len(equity_curve), max(1, len(equity_curve) // 200))],
    }


def _buy_hold_strategy(closes: list[float], dates: list[str], capital: float):
    shares = capital / closes[0]
    equity = [capital]
    trades = [{"date": dates[0], "action": "BUY", "price": closes[0], "shares": shares, "value": capital}]
    for i in range(1, len(closes)):
        equity.append(shares * closes[i])
    return trades, equity


def _sma_cross_strategy(closes: list[float], dates: list[str], capital: float, short_w: int, long_w: int):
    shares = 0.0
    cash = capital
    trades = []
    equity = []
    position = False

    for i in range(len(closes)):
        if i < long_w:
            equity.append(cash + shares * closes[i] if shares > 0 else cash)
            continue
        sma_short = sum(closes[i - short_w + 1:i + 1]) / short_w
        sma_long = sum(closes[i - long_w + 1:i + 1]) / long_w
        prev_short = sum(closes[i - short_w:i]) / short_w
        prev_long = sum(closes[i - long_w:i]) / long_w

        if not position and prev_short <= prev_long and sma_short > sma_long:
            shares = cash / closes[i]
            cash = 0
            position = True
            trades.append({"date": dates[i], "action": "BUY", "price": closes[i], "shares": round(shares, 4), "value": round(shares * closes[i], 2)})
        elif position and prev_short >= prev_long and sma_short < sma_long:
            cash = shares * closes[i]
            shares = 0
            position = False
            trades.append({"date": dates[i], "action": "SELL", "price": closes[i], "shares": 0, "value": round(cash, 2)})

        equity.append(cash + shares * closes[i] if shares > 0 else cash)

    return trades, equity
