from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    app_name: str = "CloudLabOS API"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"

    database_url: str = "sqlite+aiosqlite:///./cloudlabos.db"
    database_url_sync: str = "sqlite+pysqlite:///./cloudlabos.db"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""
    oauth_microsoft_client_id: str = ""
    oauth_microsoft_client_secret: str = ""

    sentry_dsn: str = ""
    otlp_endpoint: str = ""

    storage_backend: Literal["local", "s3"] = "local"
    s3_bucket: str = "cloudlabos"
    s3_region: str = "us-east-1"

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    default_model: str = "google/gemini-2.0-flash-lite-001"
    github_token: str = ""

    model_config = {
        "env_prefix": "CLOUDLABOS_",
        "env_file": ".env",
        "extra_allowed": ["openrouter_api_key"],
    }


settings = Settings()
