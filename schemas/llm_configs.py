from datetime import datetime
from pydantic import BaseModel
from typing import Any, Optional


class LLMConfigCreate(BaseModel):
    name: str
    provider: str = "ollama"
    model: str = "qwen2.5:7b"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    parameters: Optional[dict[str, Any]] = None
    is_active: bool = True


class LLMConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    parameters: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class LLMConfigResponse(BaseModel):
    id: int
    name: str
    provider: str
    model: str
    base_url: Optional[str]
    parameters: Optional[dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    llm_config_id: Optional[int] = None
    stream: bool = False
    max_tokens: int = 4096
    temperature: Optional[float] = None


class ChatResponse(BaseModel):
    id: str
    model: str
    content: str
    finish_reason: Optional[str]
    tokens_used: Optional[int]
