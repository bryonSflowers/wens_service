import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

import db as db_service
from schemas.portfolios import (
    PortfolioCreate, PortfolioUpdate, PortfolioResponse,
    HoldingCreate, HoldingUpdate, HoldingResponse,
    PortfolioSummaryResponse,
)
from middleware import get_current_user

router = APIRouter(prefix="/portfolios", tags=["Portfolio"])


def _get_current_prices(tickers: list[str]) -> dict[str, Optional[float]]:
    prices: dict[str, Optional[float]] = {}
    for t in set(tickers):
        try:
            tk = yf.Ticker(t)
            info = tk.info or {}
            prices[t] = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        except Exception:
            prices[t] = None
    return prices


@router.get("", response_model=list[PortfolioResponse])
async def list_portfolios(current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    return await db_service.list_portfolios(pool, current_user["id"])


@router.post("", response_model=PortfolioResponse, status_code=201)
async def create_portfolio(body: PortfolioCreate, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    portfolio = await db_service.create_portfolio(pool, current_user["id"], body.name, body.description)
    await db_service.log_audit(pool, current_user["id"], "portfolio.create", "portfolios", str(portfolio["id"]))
    return portfolio


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(portfolio_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    portfolio = await db_service.get_portfolio(pool, portfolio_id, current_user["id"])
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")
    return portfolio


@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(portfolio_id: int, body: PortfolioUpdate, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    portfolio = await db_service.update_portfolio(pool, portfolio_id, current_user["id"], body.name, body.description)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")
    await db_service.log_audit(pool, current_user["id"], "portfolio.update", "portfolios", str(portfolio_id))
    return portfolio


@router.delete("/{portfolio_id}", status_code=204)
async def delete_portfolio(portfolio_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    if not await db_service.delete_portfolio(pool, portfolio_id, current_user["id"]):
        raise HTTPException(404, "Portfolio not found")
    await db_service.log_audit(pool, current_user["id"], "portfolio.delete", "portfolios", str(portfolio_id))


@router.get("/{portfolio_id}/holdings", response_model=list[HoldingResponse])
async def list_holdings(portfolio_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    holdings = await db_service.list_holdings(pool, portfolio_id, current_user["id"])
    if not holdings:
        portfolio = await db_service.get_portfolio(pool, portfolio_id, current_user["id"])
        if not portfolio:
            raise HTTPException(404, "Portfolio not found")
        return []

    tickers = [h["ticker"] for h in holdings]
    prices = _get_current_prices(tickers)
    for h in holdings:
        price = prices.get(h["ticker"])
        h["current_price"] = price
        if price is not None:
            h["current_value"] = round(h["shares"] * price, 2)
            h["unrealized_pnl"] = round((price - h["avg_cost"]) * h["shares"], 2)
            h["unrealized_pnl_pct"] = round((price - h["avg_cost"]) / h["avg_cost"] * 100, 2) if h["avg_cost"] else None
        else:
            h["current_value"] = None
            h["unrealized_pnl"] = None
            h["unrealized_pnl_pct"] = None
    return holdings


@router.post("/{portfolio_id}/holdings", response_model=HoldingResponse, status_code=201)
async def add_holding(portfolio_id: int, body: HoldingCreate, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    holding = await db_service.add_holding(pool, portfolio_id, current_user["id"], body.ticker, body.shares, body.avg_cost, body.notes)
    if not holding:
        raise HTTPException(404, "Portfolio not found")
    await db_service.log_audit(pool, current_user["id"], "holding.create", "portfolio_holdings", str(holding["id"]))
    return holding


@router.put("/{portfolio_id}/holdings/{holding_id}", response_model=HoldingResponse)
async def update_holding(portfolio_id: int, holding_id: int, body: HoldingUpdate, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    holding = await db_service.update_holding(pool, holding_id, portfolio_id, current_user["id"], body.shares, body.avg_cost, body.notes)
    if not holding:
        raise HTTPException(404, "Holding not found")
    await db_service.log_audit(pool, current_user["id"], "holding.update", "portfolio_holdings", str(holding_id))
    return holding


@router.delete("/{portfolio_id}/holdings/{holding_id}", status_code=204)
async def delete_holding(portfolio_id: int, holding_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    if not await db_service.delete_holding(pool, holding_id, portfolio_id, current_user["id"]):
        raise HTTPException(404, "Holding not found")
    await db_service.log_audit(pool, current_user["id"], "holding.delete", "portfolio_holdings", str(holding_id))


@router.get("/{portfolio_id}/summary", response_model=PortfolioSummaryResponse)
async def portfolio_summary(portfolio_id: int, current_user: dict = Depends(get_current_user)):
    pool = await db_service.get_pool()
    portfolio = await db_service.get_portfolio(pool, portfolio_id, current_user["id"])
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")
    holdings = await db_service.list_holdings(pool, portfolio_id, current_user["id"])
    if not holdings:
        return PortfolioSummaryResponse(
            id=portfolio_id, name=portfolio["name"],
            total_cost=0, total_value=0,
            total_unrealized_pnl=0, total_unrealized_pnl_pct=0,
            holding_count=0,
        )
    tickers = [h["ticker"] for h in holdings]
    prices = _get_current_prices(tickers)
    total_cost = sum(h["shares"] * h["avg_cost"] for h in holdings)
    total_value = 0.0
    for h in holdings:
        price = prices.get(h["ticker"])
        total_value += h["shares"] * price if price is not None else 0
    pnl = total_value - total_cost
    pnl_pct = round((pnl / total_cost * 100) if total_cost else 0, 2)
    return PortfolioSummaryResponse(
        id=portfolio_id, name=portfolio["name"],
        total_cost=round(total_cost, 2),
        total_value=round(total_value, 2),
        total_unrealized_pnl=round(pnl, 2),
        total_unrealized_pnl_pct=pnl_pct,
        holding_count=len(holdings),
    )
