from contextlib import asynccontextmanager
from datetime import date
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

import db
import agent
import market_sync
from models import ReportRequest, ReportResponse

load_dotenv()

scheduler = AsyncIOScheduler()


def _previous_month() -> tuple[int, int]:
    today = date.today()
    first = today.replace(day=1)
    prev = first.replace(day=1) - __import__("datetime").timedelta(days=1)
    return prev.year, prev.month


async def _scheduled_sync() -> None:
    year, month = _previous_month()
    pool = await db.get_pool()
    await market_sync.sync_month(pool, year, month)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_pool()

    # Auto-sync previous month's market data on the 2nd of every month at 09:00
    scheduler.add_job(_scheduled_sync, CronTrigger(day=2, hour=9, minute=0))
    scheduler.start()

    yield

    scheduler.shutdown()
    await db.close_pool()


app = FastAPI(title="Wens Financial Report Service", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/reports")
async def list_reports(year: Optional[int] = None):
    pool = await db.get_pool()
    return await db.list_available_reports(pool, year)


@app.post("/generate-report", response_model=ReportResponse)
async def generate_report(request: ReportRequest):
    pool = await db.get_pool()
    try:
        report = await agent.generate_report(request.query, pool)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return ReportResponse(query=request.query, report=report)


@app.post("/sync-market-data")
async def sync_market_data(year: Optional[int] = None, month: Optional[int] = None):
    """Fetch Taiwan Mobile stock performance and merge it into the database.

    Defaults to the previous calendar month when year/month are omitted.
    """
    if (year is None) != (month is None):
        raise HTTPException(status_code=400, detail="Provide both year and month, or neither.")

    if year is None:
        year, month = _previous_month()

    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be 1–12.")

    pool = await db.get_pool()
    try:
        data = await market_sync.sync_month(pool, year, month)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "synced": True,
        "year": year,
        "month": month,
        "ticker": market_sync.TICKER,
        "price_change_pct": data.get("price_change_pct"),
        "close": data.get("close"),
        "trading_days": data.get("trading_days"),
        "news_count": len(data.get("recent_news", [])),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8190, reload=True)
