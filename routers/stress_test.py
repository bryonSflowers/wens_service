"""
Portfolio stress testing — simulates market shocks against all holdings.
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import db as db_service
from middleware import get_current_user
from yfinance_cache import get_current_prices

router = APIRouter(prefix="/portfolios", tags=["Portfolio"])


SCENARIOS = {
    "market_crash": {"label": "Market Crash (-20%)", "shock": -0.20, "description": "Broad market sell-off similar to 2008 or 2020"},
    "rate_hike": {"label": "Rate Hike (-10%)", "shock": -0.10, "description": "50bp rate hike impacting growth stocks"},
    "tech_selloff": {"label": "Tech Selloff (-15%)", "shock": -0.15, "description": "Sector rotation out of technology"},
    "recession": {"label": "Recession (-30%)", "shock": -0.30, "description": "Deep recession with broad economic contraction"},
    "recovery": {"label": "Recovery (+15%)", "shock": 0.15, "description": "Economic rebound and market recovery"},
}


@router.get("/{portfolio_id}/stress")
async def stress_test(
    portfolio_id: int,
    scenario: str = Query("market_crash", description="Scenario key"),
    current_user: dict = Depends(get_current_user),
):
    pool = await db_service.get_pool()
    portfolio = await db_service.get_portfolio(pool, portfolio_id, current_user["id"])
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    holdings = await db_service.list_holdings(pool, portfolio_id, current_user["id"])
    if not holdings:
        return {"scenario": scenario, "total_impact_pct": 0, "total_impact_dollars": 0, "holdings": []}

    tickers = [h["ticker"] for h in holdings]
    prices = await get_current_prices(tickers)

    scenario_config = SCENARIOS.get(scenario)
    if not scenario_config:
        scenarios = list(SCENARIOS.keys())
        raise HTTPException(400, f"Unknown scenario '{scenario}'. Choose: {scenarios}")

    shock = scenario_config["shock"]
    total_current_value = 0
    total_shocked_value = 0
    results = []

    for h in holdings:
        price = prices.get(h["ticker"]) or h["avg_cost"]
        current_value = h["shares"] * price
        shocked_price = price * (1 + shock)
        shocked_value = h["shares"] * shocked_price
        impact_pct = shock * 100
        results.append({
            "ticker": h["ticker"],
            "shares": h["shares"],
            "avg_cost": h["avg_cost"],
            "current_price": round(price, 2),
            "shocked_price": round(shocked_price, 2),
            "current_value": round(current_value, 2),
            "shocked_value": round(shocked_value, 2),
            "impact_dollars": round(shocked_value - current_value, 2),
            "impact_pct": round(impact_pct, 1),
        })
        total_current_value += current_value
        total_shocked_value += shocked_value

    total_impact_dollars = total_shocked_value - total_current_value
    total_impact_pct = shock * 100

    return {
        "scenario": scenario,
        "scenario_label": scenario_config["label"],
        "scenario_description": scenario_config["description"],
        "shock_pct": round(shock * 100, 1),
        "total_current_value": round(total_current_value, 2),
        "total_shocked_value": round(total_shocked_value, 2),
        "total_impact_dollars": round(total_impact_dollars, 2),
        "total_impact_pct": round(total_impact_pct, 1),
        "holdings": results,
    }


@router.get("/stress/scenarios")
async def list_scenarios():
    return [{"key": k, **v} for k, v in SCENARIOS.items()]
