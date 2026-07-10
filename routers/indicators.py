"""
Technical indicators endpoint — RSI, MACD, Bollinger Bands.
"""
import math
from datetime import date, timedelta
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException, Query

import db as db_service

router = APIRouter(prefix="/chart", tags=["Chart / Time-Series"])


def _sma(data: list[float], window: int) -> list[float]:
    result = []
    for i in range(len(data)):
        if i < window - 1:
            result.append(float('nan'))
        else:
            result.append(sum(data[i - window + 1:i + 1]) / window)
    return result


def _ema(data: list[float], window: int) -> list[float]:
    result = []
    multiplier = 2 / (window + 1)
    for i in range(len(data)):
        if i == 0:
            result.append(data[i])
        else:
            result.append((data[i] - result[-1]) * multiplier + result[-1])
    return result


@router.get("/{ticker}/indicators")
async def get_indicators(
    ticker: str,
    days: int = Query(365, ge=30, le=1825),
):
    pool = await db_service.get_pool()
    end = date.today()
    start = end - timedelta(days=days)
    rows = await db_service.get_price_history(pool, ticker, start, end)
    if len(rows) < 50:
        raise HTTPException(400, f"Need 50+ days of data for {ticker}, have {len(rows)}")

    closes = [float(r["close"]) for r in rows]
    highs = [float(r["high"]) for r in rows]
    lows = [float(r["low"]) for r in rows]
    dates = [r["date"] if isinstance(r["date"], str) else r["date"].isoformat()[:10] for r in rows]

    # RSI (14)
    rsi_values: list[float | None] = []
    for i in range(len(closes)):
        if i < 14:
            rsi_values.append(None)
            continue
        gains = losses = 0
        for j in range(i - 13, i + 1):
            change = closes[j] - closes[j - 1]
            if change > 0:
                gains += change
            else:
                losses -= change
        avg_gain = gains / 14
        avg_loss = losses / 14
        if avg_loss == 0:
            rsi_values.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi_values.append(round(100 - (100 / (1 + rs)), 2))

    # MACD (12, 26, 9)
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_line = [round(ema12[i] - ema26[i], 4) if i >= 25 else None for i in range(len(closes))]
    signal_line_list: list[float | None] = []
    valid_macd = [m for m in macd_line if m is not None]
    if len(valid_macd) >= 9:
        signal_vals = _ema(valid_macd, 9)
        sig_idx = 0
        for i in range(len(closes)):
            if macd_line[i] is not None:
                signal_line_list.append(round(signal_vals[sig_idx], 4))
                sig_idx += 1
            else:
                signal_line_list.append(None)
    else:
        signal_line_list = [None] * len(closes)
    macd_histogram = [
        round(macd_line[i] - signal_line_list[i], 4) if macd_line[i] is not None and signal_line_list[i] is not None else None
        for i in range(len(closes))
    ]

    # Bollinger Bands (20, 2)
    bb_upper: list[float | None] = []
    bb_middle = _sma(closes, 20)
    bb_lower: list[float | None] = []
    for i in range(len(closes)):
        if i < 19:
            bb_upper.append(None)
            bb_lower.append(None)
            continue
        std = np.std(closes[i - 19:i + 1], ddof=1)
        bb_upper.append(round(bb_middle[i] + 2 * std, 2))
        bb_lower.append(round(bb_middle[i] - 2 * std, 2))
    bb_middle = [round(v, 2) if not math.isnan(v) else None for v in bb_middle]

    return {
        "ticker": ticker.upper(),
        "dates": dates[-200:],
        "close": closes[-200:],
        "rsi_14": rsi_values[-200:],
        "macd": {
            "line": macd_line[-200:],
            "signal": signal_line_list[-200:],
            "histogram": macd_histogram[-200:],
        },
        "bollinger": {
            "upper": bb_upper[-200:],
            "middle": bb_middle[-200:],
            "lower": bb_lower[-200:],
        },
    }
