from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class WatchlistCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WatchlistUpdate(BaseModel):
    name: str
    description: Optional[str] = None


class WatchlistResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WatchlistItemResponse(BaseModel):
    id: int
    watchlist_id: int
    ticker: str
    notes: Optional[str]
    added_at: datetime

    model_config = {"from_attributes": True}


class PriceAlertCreate(BaseModel):
    ticker: str
    alert_type: str
    threshold_price: float
    delivery_method: str = "db"


class PriceAlertResponse(BaseModel):
    id: int
    user_id: int
    ticker: str
    alert_type: str
    threshold_price: float
    is_triggered: bool
    is_active: bool
    delivery_method: str
    triggered_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}
