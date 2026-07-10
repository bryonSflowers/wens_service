from pydantic import BaseModel
from typing import Optional, Any


class ScreenerQuery(BaseModel):
    pe_ratio_lt: Optional[float] = None
    pe_ratio_gt: Optional[float] = None
    pb_ratio_lt: Optional[float] = None
    pb_ratio_gt: Optional[float] = None
    dividend_yield_gt: Optional[float] = None
    dividend_yield_lt: Optional[float] = None
    market_cap_gt: Optional[float] = None
    market_cap_lt: Optional[float] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    roe_gt: Optional[float] = None
    eps_growth_gt: Optional[float] = None
    debt_to_equity_lt: Optional[float] = None
    sort_by: Optional[str] = None
    sort_dir: str = "desc"
    limit: int = 50
    offset: int = 0


class ScreenerResultItem(BaseModel):
    ticker: str
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    ev_ebitda: Optional[float] = None
    roe: Optional[float] = None
    debt_to_equity: Optional[float] = None
    eps: Optional[float] = None
    eps_growth_pct: Optional[float] = None
    dividend_yield: Optional[float] = None
    market_cap: Optional[float] = None
    sector: Optional[str] = None
    industry: Optional[str] = None


class ScreenerResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int
    limit: int
    offset: int
