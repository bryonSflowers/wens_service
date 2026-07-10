"""
Market Regime Detection — Hidden Markov Model (hmmlearn).
Identifies 2-3 hidden states: low-vol bull, high-vol uncertain, crisis.
"""
import asyncio
import math
from datetime import date, timedelta
from typing import Optional

import numpy as np
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from hmmlearn import hmm

router = APIRouter(prefix="/risk", tags=["Risk Analytics"])


@router.get("/{ticker}/regimes")
async def detect_regimes(
    ticker: str,
    n_states: int = Query(3, ge=2, le=4, description="Number of hidden regimes"),
    days: int = Query(756, ge=252, le=1825),
):
    end = date.today()
    start = end - timedelta(days=days)

    loop = asyncio.get_event_loop()

    def _fetch():
        tk = yf.Ticker(ticker)
        hist = tk.history(start=start.isoformat(), end=end.isoformat(), interval="1d")
        if hist.empty or len(hist) < 100:
            raise HTTPException(400, f"Insufficient data for {ticker}")
        return hist

    hist = await loop.run_in_executor(None, _fetch)
    closes = hist["Close"].values.astype(float)
    returns = np.diff(closes) / closes[:-1]

    # Train HMM on returns
    model = hmm.GaussianHMM(n_components=n_states, covariance_type="full", random_state=42, n_iter=1000)
    model.fit(returns.reshape(-1, 1))
    states = model.predict(returns.reshape(-1, 1))

    # Label regimes by volatility (state 0 = lowest vol)
    state_vols = []
    for s in range(n_states):
        mask = states == s
        vol = np.std(returns[mask]) * math.sqrt(252) * 100
        mean_ret = np.mean(returns[mask]) * 252 * 100
        state_vols.append({"state": int(s), "vol": round(float(vol), 2), "meanReturn": round(float(mean_ret), 2), "count": int(mask.sum())})

    state_vols.sort(key=lambda x: x["vol"])
    for i, sv in enumerate(state_vols):
        label = {0: "Low Vol", 1: "Medium Vol", 2: "High Vol"}.get(i, f"Regime {i}")
        if n_states == 3:
            label = ["Low Vol Bull", "Moderate", "High Vol Crisis"][i] if i < 3 else f"Regime {i}"
        sv["label"] = label

    # Map original state IDs to sorted order
    state_map = {sv["state"]: i for i, sv in enumerate(state_vols)}

    # Transition matrix
    trans_matrix = model.transmat_.tolist()

    # Current regime
    last_returns = returns[-min(20, len(returns)):]
    current_state = model.predict(last_returns.reshape(-1, 1))[-1]
    current_regime = state_map.get(int(current_state), 0)
    current_label = state_vols[current_regime]["label"]
    current_vol = state_vols[current_regime]["vol"]

    # Timeline (last 500 days)
    timeline_dates = hist.index[-len(states):].strftime("%Y-%m-%d").tolist()
    timeline = [{"date": timeline_dates[i], "state": state_map.get(int(states[i]), 0)} for i in range(len(states))]

    # VaR by regime
    var_by_regime = []
    for sv in state_vols:
        mask = states == sv["state"]
        regime_returns = returns[mask]
        if len(regime_returns) > 0:
            var95 = float(np.percentile(regime_returns, 5)) * 100
            var99 = float(np.percentile(regime_returns, 1)) * 100
        else:
            var95 = var99 = 0
        var_by_regime.append({
            "label": sv["label"],
            "var95": round(var95, 2),
            "var99": round(var99, 2),
            "annualizedVol": sv["vol"],
        })

    # Overall stats
    overall_var95 = float(np.percentile(returns, 5)) * 100
    overall_vol = float(np.std(returns)) * math.sqrt(252) * 100

    return {
        "ticker": ticker.upper(),
        "nRegimes": n_states,
        "currentRegime": {"id": current_regime, "label": current_label, "annualizedVol": current_vol},
        "regimes": state_vols,
        "varByRegime": var_by_regime,
        "var95Overall": round(overall_var95, 2),
        "volOverall": round(overall_vol, 2),
        "transitionMatrix": trans_matrix,
        "timeline": timeline[-500:],
    }
