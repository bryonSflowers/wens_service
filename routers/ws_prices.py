"""
WebSocket endpoint for real-time price streaming.

Clients connect to /ws/prices and receive price updates
for watched tickers every ~30 seconds.
"""
import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from yfinance_cache import get_current_price

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self._running = False

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        if not self._running:
            self._running = True
            asyncio.create_task(self._broadcast_loop())

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def _broadcast_loop(self):
        watchlist = ["3045.TW", "0050.TW", "2330.TW", "2454.TW", "2308.TW"]
        while self.active:
            try:
                prices = {}
                for t in watchlist:
                    price = await get_current_price(t)
                    if price:
                        prices[t] = price
                msg = json.dumps({"type": "prices", "data": prices, "ts": asyncio.get_event_loop().time()})
                for ws in self.active[:]:
                    try:
                        await ws.send_text(msg)
                    except Exception:
                        self.disconnect(ws)
            except Exception as e:
                logger.error("Price broadcast error: %s", e)
            await asyncio.sleep(30)
        self._running = False


manager = ConnectionManager()


@router.websocket("/ws/prices")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            if data.startswith("watch:"):
                tickers = data[6:].split(",")
                logger.info("Client watching tickers: %s", tickers)
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        manager.disconnect(ws)
