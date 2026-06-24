from contextlib import asynccontextmanager
from datetime import date
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import db
import agent
import market_sync
from config import settings
from middleware import RateLimitMiddleware
from schemas.common import HealthResponse
from models import ReportRequest, ReportResponse

from routers import (
    auth,
    reports as reports_router,
    templates,
    kv_store,
    llm_configs,
    generated_reports,
    export,
    admin,
    llm_proxy,
)

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
    from migrations import MIGRATIONS
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        for sql in MIGRATIONS:
            try:
                await conn.execute(sql)
            except Exception as e:
                print(f"Migration note: {e}")
    await db.log_audit(pool, None, "system.startup", "system")

    scheduler.add_job(_scheduled_sync, CronTrigger(day=2, hour=9, minute=0))
    scheduler.start()

    yield

    scheduler.shutdown()
    await db.close_pool()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)

app.include_router(auth.router)
app.include_router(reports_router.router)
app.include_router(templates.router)
app.include_router(kv_store.router)
app.include_router(llm_configs.router)
app.include_router(generated_reports.router)
app.include_router(export.router)
app.include_router(admin.router)
app.include_router(llm_proxy.router)


@app.get("/health", response_model=HealthResponse)
async def health():
    pool = await db.get_pool()
    db_ok = "connected"
    try:
        await pool.fetchval("SELECT 1")
    except Exception:
        db_ok = "disconnected"
    return HealthResponse(status="ok", version=settings.app_version, database=db_ok)


@app.get("/reports", response_model=ReportResponse)
async def list_reports_legacy(year: Optional[int] = None):
    pool = await db.get_pool()
    return await db.list_available_reports(pool, year)


@app.post("/generate-report", response_model=ReportResponse)
async def generate_report_legacy(request: ReportRequest):
    pool = await db.get_pool()
    try:
        report, _ = await agent.generate_report(request.query, pool)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return ReportResponse(query=request.query, report=report)


@app.post("/sync-market-data")
async def sync_market_data(year: Optional[int] = None, month: Optional[int] = None):
    if (year is None) != (month is None):
        raise HTTPException(400, "Provide both year and month, or neither.")
    if year is None:
        year, month = _previous_month()
    if not (1 <= month <= 12):
        raise HTTPException(400, "month must be 1-12.")
    pool = await db.get_pool()
    try:
        data = await market_sync.sync_month(pool, year, month)
    except Exception as exc:
        raise HTTPException(500, str(exc))
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
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8190))
    reload = os.environ.get("DEBUG", "").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
