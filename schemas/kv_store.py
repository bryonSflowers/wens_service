from datetime import datetime
from pydantic import BaseModel
from typing import Any, Optional


class KVItemCreate(BaseModel):
    key: str
    value: Any
    tags: Optional[list[str]] = None


class KVItemUpdate(BaseModel):
    value: Any
    tags: Optional[list[str]] = None


class KVItemResponse(BaseModel):
    id: int
    namespace: str
    key: str
    value: Any
    tags: Optional[list[str]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KVSearchParams(BaseModel):
    tags: Optional[list[str]] = None
    value_match: Optional[dict[str, Any]] = None
    page: int = 1
    page_size: int = 20
