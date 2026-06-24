from datetime import datetime
from pydantic import BaseModel
from typing import Any, Optional


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    query_text: str
    parameters_schema: Optional[dict[str, Any]] = None
    is_public: bool = False


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    query_text: Optional[str] = None
    parameters_schema: Optional[dict[str, Any]] = None
    is_public: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    query_text: str
    parameters_schema: Optional[dict[str, Any]]
    is_public: bool
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
