"""
Comprehensive financial comparison — fundamentals, risk, and performance across peers.
LLM analysis is grounded with deterministic peer-relative percentile anchors,
Piotroski F-Score, and Altman Z-Score before asking the AI to score.
"""
import asyncio
import json
import logging
import os
from typing import Any

import anthropic
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/compare", tags=["Compare"])

FINANCIAL_METRICS = [
    "totalRevenue", "ebitda", "grossProfit", "operatingIncome", "netIncome",
    "operatingCashFlow", "freeCashFlow", "capitalExpenditures",
    "totalAssets", "totalDebt", "totalCash", "totalStockholderEquity",
    "currentRatio", "debtToEquity", "returnOnEquity", "returnOnAssets",
    "earningsPerShare", "dividendYield", "payoutRatio",
    "grossMargins", "operatingMargins", "profitMargins",
]

LABEL_MAP = {
    "totalRevenue": "Revenue", "ebitda": "EBITDA", "operatingIncome": "Operating Income",
    "netIncome": "Net Income", "grossProfit": "Gross Profit", "freeCashFlow": "Free Cash Flow",
    "capitalExpenditures": "CapEx", "operatingCashFlow": "Operating Cash Flow",
    "totalAssets": "Total Assets", "totalDebt": "Total Debt", "totalCash": "Cash & Equivalents",
    "totalStockholderEquity": "Shareholders Equity", "currentRatio": "Current Ratio",
    "debtToEquity": "Debt / Equity", "returnOnEquity": "ROE", "returnOnAssets": "ROA",
    "earningsPerShare": "EPS", "dividendYield": "Dividend Yield", "payoutRatio": "Payout Ratio",
    "grossMargins": "Gross Margin", "operatingMargins": "Operating Margin", "profitMargins": "Profit Margin",
}


# ─── Deterministic scoring helpers ────────────────────────────────────────────

def _peer_percentile(values: list, val, higher_is_better: bool = True) -> int:
    """Rank val within peer group on a 0-100 scale. 100 = best in class."""
    cleaned = [v for v in values if v is not None and v == v]
    if val is None or not cleaned:
        return 50
    rank = sum(1 for v in cleaned if v <= val) / len(cleaned)
    score = rank if higher_is_better else (1.0 - rank)
    return round(score * 100)


def _piotroski(info: dict) -> tuple[int, list[str]]:
    """
    Piotroski F-Score (0–9). Tests profitability, leverage, and efficiency.
    Returns (score, list_of_passed_tests).
    Reference: Piotroski (2000), J. Accounting Research.
    """
    score = 0
    passed: list[str] = []

    roa   = info.get("returnOnAssets")
    cfo   = info.get("operatingCashFlow")
    ta    = info.get("totalAssets")
    de    = info.get("debtToEquity")
    cr    = info.get("currentRatio")
    gm    = info.get("grossMargins")
    pm    = info.get("profitMargins")
    om    = info.get("operatingMargins")
    fcf   = info.get("freeCashflow")

    if roa is not None and roa > 0:
        score += 1; passed.append("ROA > 0")
    if cfo is not None and cfo > 0:
        score += 1; passed.append("Operating CF > 0")
    if roa is not None and cfo is not None and ta and ta > 0 and (cfo / ta) > roa:
        score += 1; passed.append("CF/Assets > ROA (accrual quality)")
    if de is not None and de < 0.5:
        score += 1; passed.append("D/E < 0.5 (low leverage)")
    if cr is not None and cr > 1.5:
        score += 1; passed.append("Current ratio > 1.5")
    if gm is not None and gm > 0.25:
        score += 1; passed.append("Gross margin > 25%")
    if pm is not None and pm > 0:
        score += 1; passed.append("Net profitable")
    if om is not None and om > 0.10:
        score += 1; passed.append("Operating margin > 10%")
    if fcf is not None and fcf > 0:
        score += 1; passed.append("FCF > 0")

    return min(score, 9), passed


def _altman_z(info: dict) -> float | None:
    """
    Modified Altman Z'-Score (Altman 2000, adapted for non-manufacturing).
    Safe: Z > 2.9 | Grey zone: 1.23–2.9 | Distress: Z < 1.23
    """
    ta  = info.get("totalAssets")
    mc  = info.get("marketCap")
    td  = info.get("totalDebt") or 0
    rev = info.get("totalRevenue")
    eb  = info.get("ebitda")
    roa = info.get("returnOnAssets")
    cr  = info.get("currentRatio")

    if not ta or not mc or ta <= 0:
        return None

    re_approx = (roa * ta) if roa else 0
    wc_approx = (cr - 1) * ta * 0.15 if cr else 0

    x1 = wc_approx / ta
    x2 = re_approx / ta
    x3 = (eb / ta) if eb else 0
    x4 = mc / max(td, 1)
    x5 = (rev / ta) if rev else 0

    z = 0.717 * x1 + 0.847 * x2 + 3.107 * x3 + 0.420 * x4 + 0.998 * x5
    return round(z, 2)


def _ema_series(data: np.ndarray, span: int) -> np.ndarray:
    """Exponential moving average series."""
    k = 2.0 / (span + 1)
    out = np.empty_like(data, dtype=float)
    out[0] = data[0]
    for i in range(1, len(data)):
        out[i] = data[i] * k + out[i - 1] * (1 - k)
    return out


# ─── Routes ───────────────────────────────────────────────────────────────────

def _get_financial_series(info: dict, field: str) -> list[dict]:
    """Extract annual/quarterly data from info dict."""
    result = []
    for period in ["annual", "quarterly"]:
        raw = info.get(f"{period}_{field}") if isinstance(info.get(f"{period}_{field}"), list) else None
        if not raw:
            raw = info.get(field)
            if isinstance(raw, list):
                raw = raw[:10]
            else:
                continue
        for i, val in enumerate(raw if isinstance(raw, list) else []):
            if val is not None:
                year = 2026 - i // 4 if period == "quarterly" else 2026 - i
                quarter = 4 - (i % 4) if period == "quarterly" else None
                result.append({"year": year, "quarter": quarter, "period": period,
                                "value": float(val) if val else None})
    return result


@router.get("/financials")
async def compare_financials(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. '3045.TW,2412.TW,4904.TW'"),
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) < 2 or len(ticker_list) > 3:
        raise HTTPException(400, "Provide 2 or 3 tickers")

    from yfinance_cache import fetch_yfinance
    results = []
    for ticker in ticker_list:
        try:
            info = await fetch_yfinance(ticker, "info")
            if not info:
                results.append({"ticker": ticker, "metrics": {}, "income_stmt": {}, "balance_sheet": {}, "cash_flow": {}})
                continue
            financials_data: dict[str, Any] = {"ticker": ticker, "metrics": {}}
            for field in FINANCIAL_METRICS:
                val = info.get(field)
                financials_data["metrics"][field] = float(val) if val else None
            financials_data["income_stmt"] = {}
            financials_data["balance_sheet"] = {}
            financials_data["cash_flow"] = {}
            results.append(financials_data)
        except Exception as e:
            logger.error("Failed to fetch %s: %s", ticker, e)
            results.append({"ticker": ticker, "metrics": {}, "income_stmt": {}, "balance_sheet": {}, "cash_flow": {}})

    return {"items": results, "tickers": ticker_list, "count": len(results)}


@router.get("/analyze")
async def compare_analyze(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. '3045.TW,2412.TW,4904.TW'"),
):
    """
    LLM-powered comparative analysis grounded with:
    - Peer-relative percentile anchors (prevents uncalibrated LLM scores)
    - Piotroski F-Score (deterministic health)
    - Altman Z-Score (deterministic credit risk)
    - Analyst consensus (institutional view)
    - Richer technical indicators (MACD, ATR, 12-1 momentum, volume trend)
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) < 2 or len(ticker_list) > 4:
        raise HTTPException(400, "Provide 2–4 tickers")

    loop = asyncio.get_event_loop()

    # ── 1. Fetch fundamentals ─────────────────────────────────────────────────
    company_data: list[dict] = []
    raw_infos: dict[str, dict] = {}

    for ticker in ticker_list:
        try:
            import yfinance as yf
            tk = yf.Ticker(ticker)
            info = await loop.run_in_executor(None, lambda: tk.info or {})
            raw_infos[ticker] = info
            company_data.append({
                "ticker": ticker,
                "name": info.get("longName") or info.get("shortName") or ticker,
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "marketCap": info.get("marketCap"),
                "trailingPE": info.get("trailingPE"),
                "forwardPE": info.get("forwardPE"),
                "priceToBook": info.get("priceToBook"),
                "returnOnEquity": info.get("returnOnEquity"),
                "returnOnAssets": info.get("returnOnAssets"),
                "debtToEquity": info.get("debtToEquity"),
                "currentRatio": info.get("currentRatio"),
                "revenueGrowth": info.get("revenueGrowth"),
                "earningsGrowth": info.get("earningsGrowth"),
                "profitMargins": info.get("profitMargins"),
                "operatingMargins": info.get("operatingMargins"),
                "grossMargins": info.get("grossMargins"),
                "dividendYield": info.get("dividendYield"),
                "payoutRatio": info.get("payoutRatio"),
                "beta": info.get("beta"),
                "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
                "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
                "recommendationKey": info.get("recommendationKey"),
                "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
                "targetMeanPrice": info.get("targetMeanPrice"),
                "currentPrice": info.get("currentPrice") or info.get("regularMarketPrice"),
                "totalRevenue": info.get("totalRevenue"),
                "ebitda": info.get("ebitda"),
                "freeCashflow": info.get("freeCashflow"),
                "operatingCashFlow": info.get("operatingCashFlow"),
                "totalAssets": info.get("totalAssets"),
                "totalDebt": info.get("totalDebt"),
                "enterpriseToEbitda": info.get("enterpriseToEbitda"),
                "enterpriseValue": info.get("enterpriseValue"),
            })
        except Exception as e:
            logger.error("Failed to fetch %s: %s", ticker, e)
            raw_infos[ticker] = {}
            company_data.append({"ticker": ticker, "error": str(e)})

    # ── 2. Deterministic scores ───────────────────────────────────────────────
    piotroski_data: dict[str, tuple[int, list[str]]] = {}
    altman_data: dict[str, float | None] = {}

    for cd in company_data:
        t = cd["ticker"]
        info = raw_infos.get(t, {})
        piotroski_data[t] = _piotroski(info)
        altman_data[t] = _altman_z(info)

    # Peer-relative percentile anchors (so LLM scores are calibrated to the group)
    def _field_vals(key: str) -> list:
        return [cd.get(key) for cd in company_data]

    peer_pctiles: dict[str, dict[str, int]] = {}
    for cd in company_data:
        t = cd["ticker"]
        # valuation — lower P/E, P/B, EV/EBITDA is better
        val_pe   = _peer_percentile(_field_vals("trailingPE"),       cd.get("trailingPE"),       higher_is_better=False)
        val_pb   = _peer_percentile(_field_vals("priceToBook"),      cd.get("priceToBook"),      higher_is_better=False)
        val_ev   = _peer_percentile(_field_vals("enterpriseToEbitda"), cd.get("enterpriseToEbitda"), higher_is_better=False)
        valuation = round((val_pe + val_pb + val_ev) / 3)

        prof_roe = _peer_percentile(_field_vals("returnOnEquity"),   cd.get("returnOnEquity"),   higher_is_better=True)
        prof_pm  = _peer_percentile(_field_vals("profitMargins"),    cd.get("profitMargins"),    higher_is_better=True)
        prof_gm  = _peer_percentile(_field_vals("grossMargins"),     cd.get("grossMargins"),     higher_is_better=True)
        profitability = round((prof_roe + prof_pm + prof_gm) / 3)

        grow_rev = _peer_percentile(_field_vals("revenueGrowth"),    cd.get("revenueGrowth"),    higher_is_better=True)
        grow_eps = _peer_percentile(_field_vals("earningsGrowth"),   cd.get("earningsGrowth"),   higher_is_better=True)
        growth = round((grow_rev + grow_eps) / 2)

        hlth_de  = _peer_percentile(_field_vals("debtToEquity"),     cd.get("debtToEquity"),     higher_is_better=False)
        hlth_cr  = _peer_percentile(_field_vals("currentRatio"),     cd.get("currentRatio"),     higher_is_better=True)
        hlth_fcf = _peer_percentile(_field_vals("freeCashflow"),     cd.get("freeCashflow"),     higher_is_better=True)
        health = round((hlth_de + hlth_cr + hlth_fcf) / 3)

        peer_pctiles[t] = {
            "valuation": valuation,
            "profitability": profitability,
            "growth": growth,
            "health": health,
        }

    # Analyst consensus
    analyst_data: dict[str, dict] = {}
    for cd in company_data:
        t = cd["ticker"]
        rec = cd.get("recommendationKey") or ""
        target = cd.get("targetMeanPrice")
        current = cd.get("currentPrice")
        num = cd.get("numberOfAnalystOpinions")
        upside = round((target / current - 1) * 100, 1) if target and current and current > 0 else None
        analyst_data[t] = {
            "recommendation": rec.replace("_", " ").upper() if rec else None,
            "numAnalysts": num,
            "targetPrice": round(target, 2) if target else None,
            "currentPrice": round(current, 2) if current else None,
            "upside": upside,
        }

    # ── 3. Technical + price history ─────────────────────────────────────────
    chart_data: dict[str, dict] = {}

    for ticker in ticker_list:
        try:
            import yfinance as yf
            end = __import__("datetime").date.today()
            start = end - __import__("datetime").timedelta(days=400)
            hist = await loop.run_in_executor(
                None, lambda t=ticker: yf.Ticker(t).history(
                    start=start.isoformat(), end=end.isoformat(), interval="1d"
                )
            )
            if hist is None or hist.empty:
                continue

            closes  = hist["Close"].values.astype(float)
            highs   = hist["High"].values.astype(float)
            lows    = hist["Low"].values.astype(float)
            volumes = hist["Volume"].values.astype(float)
            n = len(closes)

            td: dict[str, Any] = {}

            # RSI(14)
            if n > 14:
                gains = losses = 0.0
                for j in range(max(1, n - 14), n):
                    chg = closes[j] - closes[j - 1]
                    if chg > 0: gains += chg
                    else: losses -= chg
                avg_g, avg_l = gains / 14, losses / 14
                td["rsi14"] = round(100 - (100 / (1 + avg_g / avg_l)), 1) if avg_l > 0 else 100.0

            # SMA 20/50
            sma20 = float(closes[-20:].mean()) if n >= 20 else None
            sma50 = float(closes[-50:].mean()) if n >= 50 else None
            if sma20: td["sma20"] = round(sma20, 2)
            if sma50: td["sma50"] = round(sma50, 2)
            if sma20 and sma50:
                td["sma20_50_cross_pct"] = round(abs(sma20 - sma50) / sma50 * 100, 2)

            # MACD (12/26 EMA, signal=9)
            if n >= 35:
                ema12 = _ema_series(closes, 12)
                ema26 = _ema_series(closes, 26)
                macd_line = ema12 - ema26
                signal_line = _ema_series(macd_line, 9)
                td["macdLine"]   = round(float(macd_line[-1]), 4)
                td["macdSignal"] = round(float(signal_line[-1]), 4)
                td["macdHistogram"] = round(float(macd_line[-1] - signal_line[-1]), 4)
                td["macdBullish"] = bool(macd_line[-1] > signal_line[-1])

            # Bollinger Bands (20, 2σ)
            if n >= 20:
                bb_mid = sma20
                bb_std = float(np.std(closes[-20:], ddof=1))
                td["bbUpper"] = round(bb_mid + 2 * bb_std, 2)
                td["bbLower"] = round(bb_mid - 2 * bb_std, 2)
                td["bbMid"]   = round(bb_mid, 2)

            # ATR(14) as % of price — volatility regime indicator
            if n >= 15:
                trs = [max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
                       for i in range(n - 14, n)]
                atr = float(np.mean(trs))
                td["atr14Pct"] = round(atr / closes[-1] * 100, 2)

            # 52-week key levels
            high52 = float(closes[-252:].max()) if n >= 252 else float(closes.max())
            low52  = float(closes[-252:].min()) if n >= 252 else float(closes.min())
            curr   = float(closes[-1])
            td["currentPrice"]  = round(curr, 2)
            td["52wHigh"]       = round(high52, 2)
            td["52wLow"]        = round(low52, 2)
            td["from52wHigh"]   = round((curr - high52) / high52 * 100, 1)
            td["from52wLow"]    = round((curr - low52) / low52 * 100, 1)

            # 12-1 month price momentum (academic momentum factor)
            if n >= 252:
                mom_12_1 = (closes[-21] - closes[-252]) / closes[-252] * 100
                td["momentum_12_1_pct"] = round(float(mom_12_1), 1)

            # Volume trend: 20-day avg vs 60-day avg
            if n >= 60:
                vol20 = float(volumes[-20:].mean())
                vol60 = float(volumes[-60:].mean())
                td["volumeTrend20v60Pct"] = round((vol20 - vol60) / vol60 * 100, 1)
                td["volumeAvg20"] = int(vol20)

            chart_data[ticker] = td
        except Exception as e:
            logger.debug("Chart data failed for %s: %s", ticker, e)

    # Momentum percentile (12-1 return rank within peer group)
    mom_vals = [chart_data.get(t, {}).get("momentum_12_1_pct") for t in ticker_list]
    for t in ticker_list:
        mv = chart_data.get(t, {}).get("momentum_12_1_pct")
        peer_pctiles[t]["momentum"] = _peer_percentile(mom_vals, mv, higher_is_better=True)

    # ── 4. Build LLM prompt ───────────────────────────────────────────────────
    prompt = "You are a senior equity research analyst. Compare the following companies:\n\n"
    for cd in company_data:
        prompt += f"--- {cd.get('name', cd['ticker'])} ({cd['ticker']})\n"
        for k, v in cd.items():
            if k not in ("ticker", "name") and v is not None:
                prompt += f"  {k}: {v:.4f}\n" if isinstance(v, float) else f"  {k}: {v}\n"
        prompt += "\n"

    prompt += "\n=== TECHNICAL DATA ===\n"
    for ticker, td in chart_data.items():
        prompt += f"\n{ticker}\n"
        for k, v in td.items():
            if v is not None:
                prompt += f"  {k}: {v}\n"

    # Pre-computed anchors — this is the key addition that calibrates LLM scores
    prompt += "\n=== PEER-RELATIVE CALIBRATION ANCHORS ===\n"
    prompt += "These are data-grounded anchors. Use them to calibrate your 0-100 scores.\n"
    prompt += "Percentiles are rank within this peer group (100 = best in class).\n\n"
    for cd in company_data:
        t = cd["ticker"]
        p_score, p_passed = piotroski_data.get(t, (0, []))
        a_z = altman_data.get(t)
        pctiles = peer_pctiles.get(t, {})
        cons = analyst_data.get(t, {})
        p_label = "Strong" if p_score >= 7 else "Average" if p_score >= 4 else "Weak"
        if a_z is not None:
            z_label = "Safe" if a_z > 2.9 else "Grey zone" if a_z > 1.23 else "Distress"
        else:
            z_label = "n/a"

        prompt += f"{t} ({cd.get('name', t)}):\n"
        prompt += f"  Piotroski F-Score: {p_score}/9 ({p_label})\n"
        if p_passed:
            prompt += f"    Passed: {', '.join(p_passed)}\n"
        if a_z is not None:
            prompt += f"  Altman Z-Score: {a_z} ({z_label})\n"
        if cons.get("recommendation"):
            prompt += f"  Analyst consensus: {cons['recommendation']}"
            if cons.get("numAnalysts"): prompt += f" ({cons['numAnalysts']} analysts)"
            if cons.get("targetPrice"): prompt += f", target ${cons['targetPrice']}"
            if cons.get("upside") is not None: prompt += f" ({cons['upside']:+.1f}% upside)"
            prompt += "\n"
        prompt += f"  Peer percentiles → Valuation:{pctiles.get('valuation',50)} "
        prompt += f"Profitability:{pctiles.get('profitability',50)} Growth:{pctiles.get('growth',50)} "
        prompt += f"Health:{pctiles.get('health',50)} Momentum:{pctiles.get('momentum',50)}\n\n"

    prompt += """\nWrite a **two-part comparative analysis**:

**PART I — FUNDAMENTALS** (concise, under 400 words)
1. Valuation — Cheapest to most expensive. Which premium is justified?
2. Profitability & Growth — Who earns best and who is growing fastest?
3. Health & Risk — Debt, dividends, cash flow, Piotroski/Altman signals.
4. Analyst view — What does the consensus say? Where is the market mispriced?

**PART II — TECHNICAL CHART ANALYSIS** (sophisticated, under 400 words)
1. **Trend & Momentum** — SMA20 vs SMA50 position. RSI regime. 12-1 month momentum.
2. **MACD** — Is the MACD line above or below signal? Histogram expanding/contracting?
3. **Volatility** — Bollinger Band position. ATR regime (expanding/contracting).
4. **Key Levels** — Proximity to 52-week high/low. Support/resistance.
5. **Volume Conviction** — Volume trend (20 vs 60 day). Is the move confirmed?
6. **Best setup NOW** — Which has the most attractive risk/reward? Who looks vulnerable?

Use ✅ ⚠️ 📌 markers. Cite specific numbers (RSI, SMA values, MACD histogram). \
Be definitive. End with a one-sentence verdict.

AFTER your analysis, output a JSON block with exactly this structure (no markdown fences):
---SCORES---
{"scores":{"TICKER":{"valuation":0,"profitability":0,"growth":0,"health":0,"momentum":0},"TICKER2":{...}},"verdict":"one sentence","sentiment":{"TICKER":"bullish/neutral/bearish"}}
---END---
Each score is 0-100 relative to peers. Anchor your scores to the peer percentiles above — \
they must be broadly consistent with those pre-computed values. Be honest, not uniformly positive."""

    # ── 5. LLM call ───────────────────────────────────────────────────────────
    try:
        provider = settings.llm_backend
        if provider == "claude":
            ac = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            resp = await ac.messages.create(
                model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
                max_tokens=4000,
                system="You are a senior equity research analyst. Be direct, quantitative, and insightful.",
                messages=[{"role": "user", "content": prompt}],
            )
            analysis = "".join(block.text for block in resp.content if block.type == "text")
        else:
            oc = AsyncOpenAI(
                base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
                api_key="ollama",
            )
            resp = await oc.chat.completions.create(
                model=os.getenv("OLLAMA_MODEL", "qwen2.5:7b"),
                messages=[{"role": "system", "content": "You are a senior equity research analyst."},
                          {"role": "user", "content": prompt}],
                max_tokens=4000,
            )
            analysis = resp.choices[0].message.content or ""
    except Exception as e:
        logger.error("LLM analysis failed: %s", e)
        analysis = f"Analysis unavailable (LLM error: {e})"

    # ── 6. Parse structured output ────────────────────────────────────────────
    scores = None
    verdict = ""
    sentiment: dict[str, str] = {}
    try:
        import re
        m = re.search(r'---SCORES---\n(.*?)\n---END---', analysis, re.DOTALL)
        if m:
            parsed = json.loads(m.group(1))
            scores = parsed.get("scores")
            verdict = parsed.get("verdict", "")
            sentiment = parsed.get("sentiment", {})
            analysis = analysis[:m.start()].strip()
    except Exception as e:
        logger.debug("Could not parse scores: %s", e)

    # Build fundamentals breakdown for UI
    fundamentals_breakdown: dict[str, dict] = {}
    for t in ticker_list:
        p_score, p_passed = piotroski_data.get(t, (0, []))
        a_z = altman_data.get(t)
        fundamentals_breakdown[t] = {
            "piotroski": p_score,
            "piotroski_label": "Strong" if p_score >= 7 else "Average" if p_score >= 4 else "Weak",
            "piotroski_passed": p_passed,
            "altman_z": a_z,
            "altman_zone": ("safe" if a_z and a_z > 2.9 else "grey" if a_z and a_z > 1.23 else "distress") if a_z is not None else None,
            "peer_percentiles": peer_pctiles.get(t, {}),
        }

    return {
        "tickers": ticker_list,
        "analysis": analysis,
        "scores": scores,
        "verdict": verdict,
        "sentiment": sentiment,
        "consensus": analyst_data,
        "fundamentals_breakdown": fundamentals_breakdown,
        "generated_at": __import__("datetime").datetime.utcnow().isoformat(),
    }


@router.post("/chat")
async def compare_chat(body: dict):
    """Follow-up chat. Body: { tickers, analysis, messages }"""
    tickers = body.get("tickers", [])
    analysis = body.get("analysis", "")
    messages = body.get("messages", [])

    if not messages:
        raise HTTPException(400, "No messages provided")

    system = f"""You are a senior equity research analyst. You have already produced this analysis of {', '.join(tickers)}:

{analysis[:6000]}

Answer follow-up questions using the analysis above and your financial knowledge. \
Be specific, reference numbers, and compare companies directly."""

    try:
        provider = settings.llm_backend
        if provider == "claude":
            ac = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            resp = await ac.messages.create(
                model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
                max_tokens=2000,
                system=system,
                messages=[m for m in messages if m["role"] in ("user", "assistant")],
            )
            reply = "".join(block.text for block in resp.content if block.type == "text")
        else:
            oc = AsyncOpenAI(
                base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
                api_key="ollama",
            )
            resp = await oc.chat.completions.create(
                model=os.getenv("OLLAMA_MODEL", "qwen2.5:7b"),
                messages=[{"role": "system", "content": system}] + messages,
                max_tokens=2000,
            )
            reply = resp.choices[0].message.content or ""
    except Exception as e:
        logger.error("Follow-up LLM failed: %s", e)
        reply = f"Error: {e}"

    return {"reply": reply}
