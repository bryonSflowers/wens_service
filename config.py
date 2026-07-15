import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    database_url: str = field(default_factory=lambda: os.environ["DATABASE_URL"])
    llm_backend: str = field(default_factory=lambda: os.getenv("LLM_BACKEND", "opencode"))
    ollama_model: str = field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "qwen2.5:7b"))
    ollama_base_url: str = field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"))
    anthropic_api_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    jwt_secret: str = field(default_factory=lambda: os.getenv("JWT_SECRET", "change-me-to-a-secure-secret"))
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    app_name: str = "Wens Financial Report Service"
    app_version: str = "2.0.0"
    debug: bool = field(default_factory=lambda: os.getenv("DEBUG", "false").lower() == "true")
    cors_origins: list[str] = field(default_factory=lambda: os.getenv("CORS_ORIGINS", "https://wensservice-production.up.railway.app").split(","))
    encryption_key: str = field(default_factory=lambda: os.getenv("ENCRYPTION_KEY", ""))
    yfinance_cache_ttl: int = int(os.getenv("YFINANCE_CACHE_TTL", "300"))


settings = Settings()
