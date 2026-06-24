from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional

import db
from schemas.auth import (
    UserCreate, UserResponse, UserLogin, TokenResponse,
    APIKeyCreate, APIKeyResponse, APIKeyFullResponse,
)
from services import auth_service
from middleware import get_current_user, get_current_user_optional

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
async def register(body: UserCreate):
    pool = await db.get_pool()
    try:
        user = await auth_service.create_user(pool, body.username, body.email, body.password, body.role)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.log_audit(pool, user["id"], "user.register", "users", str(user["id"]))
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, request: Request):
    pool = await db.get_pool()
    user = await auth_service.authenticate_user(pool, body.username, body.password)
    if not user:
        raise HTTPException(401, "Invalid credentials")
    token = auth_service.create_token(user)
    await db.log_audit(pool, user["id"], "user.login", "users", str(user["id"]), ip_address=request.client.host if request.client else None)
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/api-keys", response_model=APIKeyFullResponse)
async def create_api_key(body: APIKeyCreate, current_user: dict = Depends(get_current_user)):
    pool = await db.get_pool()
    result = await auth_service.generate_api_key(pool, current_user["id"], body.name, body.scopes)
    await db.log_audit(pool, current_user["id"], "api_key.create", "api_keys", str(result["id"]))
    return result


@router.get("/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    pool = await db.get_pool()
    rows = await pool.fetch(
        "SELECT id, name, key_prefix, scopes, is_active, expires_at, created_at "
        "FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
        current_user["id"],
    )
    return [dict(r) for r in rows]
