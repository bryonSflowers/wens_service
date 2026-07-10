from pydantic import BaseModel
from typing import Optional


class VolatilityResponse(BaseModel):
    ticker: str
    days: int
    annualized_volatility_pct: float


class SharpeResponse(BaseModel):
    ticker: str
    sharpe_ratio: float
    risk_free_rate_pct: float
    annualized_return_pct: float
    annualized_volatility_pct: float


class MaxDrawdownResponse(BaseModel):
    ticker: str
    max_drawdown_pct: float
    peak_date: Optional[str] = None
    trough_date: Optional[str] = None


class VaRResponse(BaseModel):
    ticker: str
    confidence: float
    var_daily_pct: float
    var_weekly_pct: float
    var_monthly_pct: float


class BetaResponse(BaseModel):
    ticker: str
    index_ticker: str
    beta: float
    correlation: float


class RiskAllResponse(BaseModel):
    ticker: str
    annualized_volatility_pct: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown_pct: Optional[float] = None
    var_95_daily_pct: Optional[float] = None
    beta_vs_index: Optional[float] = None
    index_ticker: Optional[str] = None
