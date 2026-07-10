"""
Comprehensive financial comparison — pulls income statement, balance sheet,
cash flow, and key metrics from yfinance for multiple tickers.
Includes LLM-powered comparative analysis.
"""
import asyncio
import json
import logging
import os
from typing import Any, Optional

import anthropic
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)

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
    "totalRevenue": "Revenue",
    "ebitda": "EBITDA",
    "operatingIncome": "Operating Income",
    "netIncome": "Net Income",
    "grossProfit": "Gross Profit",
    "freeCashFlow": "Free Cash Flow",
    "capitalExpenditures": "CapEx",
    "operatingCashFlow": "Operating Cash Flow",
    "totalAssets": "Total Assets",
    "totalDebt": "Total Debt",
    "totalCash": "Cash & Equivalents",
    "totalStockholderEquity": "Shareholders Equity",
    "currentRatio": "Current Ratio",
    "debtToEquity": "Debt / Equity",
    "returnOnEquity": "ROE",
    "returnOnAssets": "ROA",
    "earningsPerShare": "EPS",
    "dividendYield": "Dividend Yield",
    "payoutRatio": "Payout Ratio",
    "grossMargins": "Gross Margin",
    "operatingMargins": "Operating Margin",
    "profitMargins": "Profit Margin",
}


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
                result.append({
                    "year": year,
                    "quarter": quarter,
                    "period": period,
                    "value": float(val) if val else None,
                })
    return result


@router.get("/financials")
async def compare_financials(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. '3045.TW,2412.TW,4904.TW'"),
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) < 2 or len(ticker_list) > 3:
        raise HTTPException(400, "Provide 2 or 3 tickers")

    loop = asyncio.get_event_loop()
    results = []

    for ticker in ticker_list:
        try:
            import yfinance as yf
            tk = yf.Ticker(ticker)
            info = await loop.run_in_executor(None, lambda: tk.info or {})

            financials_data: dict[str, Any] = {"ticker": ticker, "metrics": {}}
            for field in FINANCIAL_METRICS:
                val = info.get(field)
                financials_data["metrics"][field] = float(val) if val else None

            # Historical financials
            financials_data["income_stmt"] = {}
            try:
                inc = await loop.run_in_executor(None, lambda: tk.income_stmt)
                if inc is not None and not inc.empty:
                    for col in inc.columns[:5]:
                        date_str = str(col.date()) if hasattr(col, "date") else str(col)[:10]
                        financials_data["income_stmt"][date_str] = {}
                        for row_label in ["Total Revenue", "EBITDA", "Operating Income", "Net Income"]:
                            if row_label in inc.index:
                                val = inc.loc[row_label, col]
                                financials_data["income_stmt"][date_str][row_label] = float(val) if val else None
            except Exception as e:
                logger.debug("Income stmt failed for %s: %s", ticker, e)

            financials_data["balance_sheet"] = {}
            try:
                bs = await loop.run_in_executor(None, lambda: tk.balance_sheet)
                if bs is not None and not bs.empty:
                    for col in bs.columns[:5]:
                        date_str = str(col.date()) if hasattr(col, "date") else str(col)[:10]
                        financials_data["balance_sheet"][date_str] = {}
                        for row_label in ["Total Assets", "Total Debt", "Cash And Cash Equivalents", "Total Equity"]:
                            if row_label in bs.index:
                                val = bs.loc[row_label, col]
                                financials_data["balance_sheet"][date_str][row_label] = float(val) if val else None
            except Exception as e:
                logger.debug("Balance sheet failed for %s: %s", ticker, e)

            financials_data["cash_flow"] = {}
            try:
                cf = await loop.run_in_executor(None, lambda: tk.cash_flow)
                if cf is not None and not cf.empty:
                    for col in cf.columns[:5]:
                        date_str = str(col.date()) if hasattr(col, "date") else str(col)[:10]
                        financials_data["cash_flow"][date_str] = {}
                        for row_label in ["Free Cash Flow", "Capital Expenditure", "Operating Cash Flow"]:
                            if row_label in cf.index:
                                val = cf.loc[row_label, col]
                                financials_data["cash_flow"][date_str][row_label] = float(val) if val else None
            except Exception as e:
                logger.debug("Cash flow failed for %s: %s", ticker, e)

            results.append(financials_data)
        except Exception as e:
            logger.error("Failed to fetch %s: %s", ticker, e)

    return {"items": results, "tickers": ticker_list, "count": len(results)}


@router.get("/analyze")
async def compare_analyze(
    tickers: str = Query(..., description="Comma-separated tickers, e.g. '3045.TW,2412.TW,4904.TW'"),
):
    """LLM-powered comparative analysis. Fetches data then asks the AI for insights."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(ticker_list) < 2 or len(ticker_list) > 4:
        raise HTTPException(400, "Provide 2–4 tickers")

    # Fetch financials
    loop = asyncio.get_event_loop()
    company_data = []
    for ticker in ticker_list:
        try:
            import yfinance as yf
            tk = yf.Ticker(ticker)
            info = await loop.run_in_executor(None, lambda: tk.info or {})
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
                "revenueGrowth": info.get("revenueGrowth"),
                "earningsGrowth": info.get("earningsGrowth"),
                "profitMargins": info.get("profitMargins"),
                "operatingMargins": info.get("operatingMargins"),
                "dividendYield": info.get("dividendYield"),
                "payoutRatio": info.get("payoutRatio"),
                "beta": info.get("beta"),
                "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
                "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
                "recommendationKey": info.get("recommendationKey"),
                "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
                "targetMeanPrice": info.get("targetMeanPrice"),
                "currentPrice": info.get("currentPrice"),
                "totalRevenue": info.get("totalRevenue"),
                "ebitda": info.get("ebitda"),
                "freeCashflow": info.get("freeCashflow"),
                "operatingCashFlow": info.get("operatingCashFlow"),
                "grossMargins": info.get("grossMargins"),
                "enterpriseToEbitda": info.get("enterpriseToEbitda"),
                "enterpriseValue": info.get("enterpriseValue"),
            })
        except Exception as e:
            logger.error("Failed to fetch %s: %s", ticker, e)
            company_data.append({"ticker": ticker, "error": str(e)})

    # Build prompt
    prompt = "You are a senior equity research analyst. Compare the following companies across these dimensions:\n\n"
    for cd in company_data:
        prompt += f"--- {cd.get('name', cd['ticker'])} ({cd['ticker']})\n"
        for k, v in cd.items():
            if k not in ("ticker", "name") and v is not None:
                if isinstance(v, float):
                    prompt += f"  {k}: {v:.4f}\n"
                else:
                    prompt += f"  {k}: {v}\n"
        prompt += "\n"

    prompt += """Provide a structured comparative analysis covering:

1. **Valuation** — Which is cheapest/most expensive on P/E, P/B, EV/EBITDA? Is the premium justified?
2. **Profitability** — Compare margins, ROE, ROA. Who operates most efficiently?
3. **Growth** — Revenue growth, earnings growth trends. Who is gaining market share?
4. **Financial Health** — Debt levels, cash flow generation, dividend sustainability.
5. **Risk** — Beta, volatility, analyst consensus. What keeps each CEO up at night?
6. **Competitive Position** — Moats, market leadership, threats from new entrants or substitutes.
7. **Divergence** — Where do the numbers tell a different story than the market price? What is the market mispricing?
8. **Catalysts** — For each company, what 1-2 events in the next 12 months could move the stock meaningfully?

Use specific figures from the data. Be direct, be honest. Flag weaknesses, not just strengths.
End with a clear verdict: which is best positioned for the next 12 months, and why."""

    try:
        provider = settings.llm_backend
        if provider == "claude":
            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            resp = await client.messages.create(
                model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
                max_tokens=4000,
                system="You are a senior equity research analyst. Be direct, quantitative, and insightful.",
                messages=[{"role": "user", "content": prompt}],
            )
            analysis = "".join(block.text for block in resp.content if block.type == "text")
        else:
            client = AsyncOpenAI(
                base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
                api_key="ollama",
            )
            resp = await client.chat.completions.create(
                model=os.getenv("OLLAMA_MODEL", "qwen2.5:7b"),
                messages=[{"role": "system", "content": "You are a senior equity research analyst."},
                          {"role": "user", "content": prompt}],
                max_tokens=4000,
            )
            analysis = resp.choices[0].message.content or ""
    except Exception as e:
        logger.error("LLM analysis failed: %s", e)
        analysis = f"Analysis unavailable (LLM error: {e})"

    return {
        "tickers": ticker_list,
        "analysis": analysis,
        "generated_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
