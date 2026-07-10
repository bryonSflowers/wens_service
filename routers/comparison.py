"""
Comprehensive financial comparison — pulls income statement, balance sheet,
cash flow, and key metrics from yfinance for multiple tickers.
"""
import asyncio
import logging
from typing import Any, Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query

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
