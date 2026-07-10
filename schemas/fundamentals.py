from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class FundamentalResponse(BaseModel):
    ticker: str
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    ev_ebitda: Optional[float] = None
    roe: Optional[float] = None
    debt_to_equity: Optional[float] = None
    eps: Optional[float] = None
    eps_growth_pct: Optional[float] = None
    dividend_yield: Optional[float] = None
    dividend_payout_ratio: Optional[float] = None
    market_cap: Optional[float] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FundamentalRefreshResponse(BaseModel):
    ticker: str
    status: str
    data: FundamentalResponse
