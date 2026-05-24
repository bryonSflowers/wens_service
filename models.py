from pydantic import BaseModel
from typing import Optional


class ReportRequest(BaseModel):
    query: str


class ReportResponse(BaseModel):
    query: str
    report: str
