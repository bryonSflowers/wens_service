import time
from typing import Optional
from fastapi import Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

import db
from services import auth_service


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = self._requests.get(client_ip, [])
        window = [t for t in window if now - t < self.window_seconds]
        if len(window) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
            )
        window.append(now)
        self._requests[client_ip] = window
        return await call_next(request)


def require_role(role: str):
    async def _check(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in ("admin", role):
            raise HTTPException(403, f"Requires role: {role}")
        return current_user
    return _check


async def get_current_user(request: Request) -> dict:
    user = await _resolve_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


async def get_current_user_optional(request: Request) -> Optional[dict]:
    return await _resolve_user(request)


async def _resolve_user(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = auth_service.verify_token(token)
        if payload:
            return {
                "id": int(payload["sub"]),
                "username": payload["username"],
                "role": payload["role"],
            }

    api_key = request.headers.get("X-API-Key", "")
    if api_key:
        pool = await db.get_pool()
        result = await auth_service.verify_api_key(pool, api_key)
        if result:
            return {
                "id": result["user_id"],
                "username": result["username"],
                "role": result["role"],
                "api_key_name": result["name"],
            }

    return None
