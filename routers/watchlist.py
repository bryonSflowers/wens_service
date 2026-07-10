from datetime import date, timedelta
from typing import Optional

import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException

import db as db_service
from schemas.watchlist import (
    WatchlistCreate, WatchlistUpdate, WatchlistResponse,
    WatchlistItemResponse, PriceAlertCreate, PriceAlertResponse,
)
from middleware import get_current_user

router = APIRouter(prefix="/watchlists", tags=["Watchlist & Alerts"])


# -- Watchlists --

@router.get("", response_model=list[WatchlistResponse])
async def list_watchlists(current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    return await db_service.list_watchlists(pool, current_user["id"])


@router.post("", response_model=WatchlistResponse, status_code=201)
async def create_watchlist(body: WatchlistCreate, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    wl = await db_service.create_watchlist(pool, current_user["id"], body.name, body.description)
    await db_service.log_audit(pool, current_user["id"], "watchlist.create", "watchlists", str(wl["id"]))
    return wl


@router.get("/{watchlist_id}", response_model=WatchlistResponse)
async def get_watchlist(watchlist_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    wl = await db_service.get_watchlist(pool, watchlist_id, current_user["id"])
    if not wl:
        raise HTTPException(404, "Watchlist not found")
    return wl


@router.put("/{watchlist_id}", response_model=WatchlistResponse)
async def update_watchlist(watchlist_id: int, body: WatchlistUpdate, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    wl = await db_service.update_watchlist(pool, watchlist_id, current_user["id"], body.name, body.description)
    if not wl:
        raise HTTPException(404, "Watchlist not found")
    return wl


@router.delete("/{watchlist_id}", status_code=204)
async def delete_watchlist(watchlist_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    if not await db_service.delete_watchlist(pool, watchlist_id, current_user["id"]):
        raise HTTPException(404, "Watchlist not found")


# -- Watchlist Items --

@router.get("/{watchlist_id}/items", response_model=list[WatchlistItemResponse])
async def list_watchlist_items(watchlist_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    items = await db_service.list_watchlist_items(pool, watchlist_id, current_user["id"])
    return items


@router.post("/{watchlist_id}/items", response_model=WatchlistItemResponse, status_code=201)
async def add_watchlist_item(
    watchlist_id: int, ticker: str, notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    pool = await db_service.get_pool()
    item = await db_service.add_watchlist_item(pool, watchlist_id, current_user["id"], ticker, notes)
    if not item:
        raise HTTPException(404, "Watchlist not found")
    return item


@router.delete("/{watchlist_id}/items/{item_id}", status_code=204)
async def remove_watchlist_item(
    watchlist_id: int, item_id: int,
    current_user: dict = Depends(get_current_user),
):
    pool = await db_service.get_pool()
    if not await db_service.remove_watchlist_item(pool, item_id, watchlist_id, current_user["id"]):
        raise HTTPException(404, "Item not found")


# -- Price Alerts --

@router.get("/alerts", response_model=list[PriceAlertResponse])
async def list_alerts(ticker: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    return await db_service.list_price_alerts(pool, user_id=current_user["id"], ticker=ticker)


@router.post("/alerts", response_model=PriceAlertResponse, status_code=201)
async def create_alert(body: PriceAlertCreate, current_user: dict = Depends(get_current_user)):
    if body.alert_type not in ("above", "below"):
        raise HTTPException(400, "alert_type must be 'above' or 'below'")
    pool = await db_service.get_pool()
    alert = await db_service.create_price_alert(
        pool, current_user["id"], body.ticker,
        body.alert_type, body.threshold_price, body.delivery_method,
    )
    await db_service.log_audit(pool, current_user["id"], "alert.create", "price_alerts", str(alert["id"]))
    return alert


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(alert_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    if not await db_service.delete_price_alert(pool, alert_id, current_user["id"]):
        raise HTTPException(404, "Alert not found")


@router.post("/alerts/check")
async def check_alerts(ticker: Optional[str] = None):
    pool = await db_service.get_pool()
    triggered = []
    if ticker:
        alerts = await db_service.get_active_alerts_by_ticker(pool, ticker)
        tk_list = [ticker.upper()]
    else:
        alerts = []
        tk_list = []
        all_rows = await pool.fetch("SELECT DISTINCT ticker FROM price_alerts WHERE is_active = TRUE AND is_triggered = FALSE")
        tk_list = [r["ticker"] for r in all_rows]

    prices: dict[str, float] = {}
    for t in set(tk_list):
        try:
            tk = yf.Ticker(t)
            info = tk.info or {}
            price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
            if price:
                prices[t] = float(price)
        except Exception:
            pass

    if ticker:
        for alert in alerts:
            t = alert["ticker"]
            price = prices.get(t)
            if price is None:
                continue
            hit = (alert["alert_type"] == "above" and price >= alert["threshold_price"]) or \
                  (alert["alert_type"] == "below" and price <= alert["threshold_price"])
            if hit:
                await db_service.trigger_alert(pool, alert["id"])
                triggered.append({
                    "alert_id": alert["id"],
                    "ticker": t,
                    "current_price": price,
                    "threshold": alert["threshold_price"],
                    "type": alert["alert_type"],
                })
    else:
        for t in set(tk_list):
            tk_alerts = await db_service.get_active_alerts_by_ticker(pool, t)
            price = prices.get(t)
            if price is None:
                continue
            for alert in tk_alerts:
                hit = (alert["alert_type"] == "above" and price >= alert["threshold_price"]) or \
                      (alert["alert_type"] == "below" and price <= alert["threshold_price"])
                if hit:
                    await db_service.trigger_alert(pool, alert["id"])
                    triggered.append({
                        "alert_id": alert["id"],
                        "ticker": t,
                        "current_price": price,
                        "threshold": alert["threshold_price"],
                        "type": alert["alert_type"],
                    })

    return {"checked": True, "triggered_count": len(triggered), "triggered": triggered}
