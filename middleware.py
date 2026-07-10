import logging
import time
import uuid
from typing import Optional

from fastapi import Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

import db
from services import auth_service

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = rid
        start = time.time()
        response = await call_next(request)
        elapsed = time.time() - start
        response.headers["X-Request-ID"] = rid
        response.headers["X-Response-Time"] = f"{elapsed*1000:.0f}ms"
        logger.info("req_id=%s method=%s path=%s status=%d elapsed=%.0fms",
                     rid, request.method, request.url.path, response.status_code, elapsed * 1000)
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._ip_buckets: dict[str, list[float]] = {}
        self._user_buckets: dict[int, list[float]] = {}

    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/health", "/admin/health"):
            return await call_next(request)

        now = time.time()
        client_ip = request.client.host if request.client else "unknown"
        user_id = getattr(request.state, "user_id", None)

        if user_id is not None:
            bucket = self._user_buckets.setdefault(user_id, [])
            key_type = "user"
        else:
            bucket = self._ip_buckets.setdefault(client_ip, [])
            key_type = "ip"

        bucket[:] = [t for t in bucket if now - t < self.window_seconds]
        if len(bucket) >= self.max_requests:
            logger.warning("rate_limit_exceeded %s=%s path=%s", key_type,
                           user_id or client_ip, request.url.path)
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded ({self.max_requests}/{self.window_seconds}s)."},
            )
        bucket.append(now)
        return await call_next(request)


async def get_current_user(request: Request) -> dict:
    user = await _resolve_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    request.state.user_id = user["id"]
    return user


async def get_current_user_optional(request: Request) -> Optional[dict]:
    user = await _resolve_user(request)
    if user:
        request.state.user_id = user["id"]
    return user


def require_role(role: str):
    async def _check(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in ("admin", role):
            raise HTTPException(403, f"Requires role: {role}")
        return current_user
    return _check


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
