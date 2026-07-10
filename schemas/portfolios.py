from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PortfolioUpdate(BaseModel):
    name: str
    description: Optional[str] = None


class PortfolioResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HoldingCreate(BaseModel):
    ticker: str
    shares: float
    avg_cost: float
    notes: Optional[str] = None


class HoldingUpdate(BaseModel):
    shares: float
    avg_cost: float
    notes: Optional[str] = None


class HoldingResponse(BaseModel):
    id: int
    portfolio_id: int
    ticker: str
    shares: float
    avg_cost: float
    current_price: Optional[float] = None
    current_value: Optional[float] = None
    unrealized_pnl: Optional[float] = None
    unrealized_pnl_pct: Optional[float] = None
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioSummaryResponse(BaseModel):
    id: int
    name: str
    total_cost: float
    total_value: float
    total_unrealized_pnl: float
    total_unrealized_pnl_pct: float
    holding_count: int
