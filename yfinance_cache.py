"""
Shared yfinance fetcher with in-memory TTL cache.

All routers should call this instead of calling yfinance directly.
"""
import asyncio
import logging
import time
from typing import Any, Optional

import yfinance as yf

from config import settings

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, Any]] = {}


async def fetch_yfinance(ticker: str, method: str = "info", **kwargs) -> Any:
    """Fetch yfinance data with TTL cache. Runs the blocking call in executor."""
    key = f"{ticker}:{method}:{str(kwargs)}"
    now = time.time()
    cached = _cache.get(key)
    if cached and (now - cached[0]) < settings.yfinance_cache_ttl:
        return cached[1]

    loop = asyncio.get_event_loop()

    def _fetch():
        tk = yf.Ticker(ticker)
        if method == "info":
            return tk.info or {}
        if method == "history":
            hist = tk.history(**kwargs)
            return hist
        if method == "price":
            info = tk.info or {}
            return info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        if method == "news":
            return tk.news or []
        return {}

    result = await loop.run_in_executor(None, _fetch)
    _cache[key] = (now, result)
    return result


async def get_current_price(ticker: str) -> Optional[float]:
    """Get current price with caching."""
    price = await fetch_yfinance(ticker, "price")
    return float(price) if price else None


async def get_current_prices(tickers: list[str]) -> dict[str, Optional[float]]:
    """Get current prices for multiple tickers."""
    tasks = [get_current_price(t) for t in set(tickers)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    prices: dict[str, Optional[float]] = {}
    for t, r in zip(set(tickers), results):
        prices[t] = float(r) if isinstance(r, (int, float)) else None
    return prices


async def fetch_historical_prices(ticker: str, period: str = "1y", interval: str = "1d") -> Any:
    """Fetch historical price data with caching."""
    return await fetch_yfinance(ticker, "history", period=period, interval=interval)


def clear_cache() -> None:
    """Clear the yfinance cache."""
    _cache.clear()
