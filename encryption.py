"""
API key encryption at rest using Fernet (symmetric AES).
Falls back to base64 encoding if no encryption key is configured.
"""
import base64
import hashlib
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from config import settings

logger = logging.getLogger(__name__)

_fernet: Optional[Fernet] = None


def _get_fernet() -> Optional[Fernet]:
    global _fernet
    if _fernet is not None:
        return _fernet
    key = settings.encryption_key
    if not key:
        logger.warning("ENCRYPTION_KEY not set — API keys will be stored as base64 (not encrypted)")
        return None
    try:
        # Derive a 32-byte key for Fernet
        derived = hashlib.sha256(key.encode()).digest()
        fkey = base64.urlsafe_b64encode(derived)
        _fernet = Fernet(fkey)
        return _fernet
    except Exception as e:
        logger.error("Failed to initialize encryption: %s", e)
        return None


def encrypt(plaintext: str) -> str:
    f = _get_fernet()
    if f:
        return f.encrypt(plaintext.encode()).decode()
    return base64.b64encode(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    f = _get_fernet()
    if f:
        try:
            return f.decrypt(ciphertext.encode()).decode()
        except InvalidToken:
            logger.error("Failed to decrypt — data may be corrupted")
            return ""
    try:
        return base64.b64decode(ciphertext.encode()).decode()
    except Exception:
        return ciphertext
