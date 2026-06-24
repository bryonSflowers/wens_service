from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class APIKeyCreate(BaseModel):
    name: str
    scopes: list[str] = ["read"]


class APIKeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    scopes: list[str]
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class APIKeyFullResponse(APIKeyResponse):
    full_key: str
