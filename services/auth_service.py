import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional

import asyncpg
from config import settings


async def _ensure_admin(pool: asyncpg.Pool) -> int:
    row = await pool.fetchrow("SELECT id FROM users WHERE username = 'admin'")
    if row:
        return row["id"]
    pw_hash = _hash_password("admin")
    row = await pool.fetchrow(
        "INSERT INTO users (username, email, password_hash, role) "
        "VALUES ($1, $2, $3, $4) RETURNING id",
        "admin", "admin@wens.local", pw_hash, "admin",
    )
    return row["id"]


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return f"{salt}${h.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    salt, hx = stored.split("$", 1)
    h = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return h.hex() == hx


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    s = s + "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _create_jwt(payload: dict) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(settings.jwt_secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"


def _decode_jwt(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        expected_sig = hmac.new(
            settings.jwt_secret.encode(),
            f"{parts[0]}.{parts[1]}".encode(),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(expected_sig, _unb64(parts[2])):
            return None
        payload = json.loads(_unb64(parts[1]))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


async def create_user(pool: asyncpg.Pool, username: str, email: str, password: str, role: str = "viewer") -> dict:
    existing = await pool.fetchrow(
        "SELECT id FROM users WHERE username = $1 OR email = $2", username, email
    )
    if existing:
        raise ValueError("Username or email already exists")
    pw_hash = _hash_password(password)
    row = await pool.fetchrow(
        "INSERT INTO users (username, email, password_hash, role) "
        "VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, is_active, created_at",
        username, email, pw_hash, role,
    )
    return dict(row)


async def authenticate_user(pool: asyncpg.Pool, username: str, password: str) -> Optional[dict]:
    row = await pool.fetchrow(
        "SELECT id, username, email, password_hash, role, is_active, created_at "
        "FROM users WHERE username = $1", username,
    )
    if not row or not row["is_active"]:
        return None
    if not _verify_password(password, row["password_hash"]):
        return None
    return dict(row)


def create_token(user: dict) -> str:
    now = time.time()
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "iat": int(now),
        "exp": int(now + settings.jwt_expire_minutes * 60),
    }
    return _create_jwt(payload)


def verify_token(token: str) -> Optional[dict]:
    return _decode_jwt(token)


async def generate_api_key(pool: asyncpg.Pool, user_id: int, name: str, scopes: list[str]) -> dict:
    raw_key = f"wen_{secrets.token_hex(24)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:8]
    row = await pool.fetchrow(
        "INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING id, name, key_prefix, scopes, is_active, expires_at, created_at",
        user_id, name, key_hash, key_prefix, scopes,
    )
    result = dict(row)
    result["full_key"] = raw_key
    return result


async def verify_api_key(pool: asyncpg.Pool, raw_key: str) -> Optional[dict]:
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    row = await pool.fetchrow(
        "SELECT ak.id, ak.user_id, ak.name, ak.scopes, ak.is_active, "
        "u.username, u.role "
        "FROM api_keys ak JOIN users u ON u.id = ak.user_id "
        "WHERE ak.key_hash = $1 AND ak.is_active = TRUE "
        "AND (ak.expires_at IS NULL OR ak.expires_at > NOW())",
        key_hash,
    )
    if row:
        return dict(row)
    return None
