from datetime import datetime
from pydantic import BaseModel
from typing import Any, Optional


class ReportResponse(BaseModel):
    id: int
    year: int
    month: int
    revenue: Optional[float]
    expenses: Optional[float]
    net_income: Optional[float]
    report_data: Optional[dict[str, Any]]
    notes: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ReportGenerateRequest(BaseModel):
    query: str
    template_id: Optional[int] = None
    llm_config_id: Optional[int] = None
    stream: bool = False


class ReportGenerateResponse(BaseModel):
    id: int
    query: str
    report: str
    model: Optional[str]
    tokens_used: Optional[int]
    created_at: Optional[datetime]


class ReportListParams(BaseModel):
    year: Optional[int] = None
    page: int = 1
    page_size: int = 20
