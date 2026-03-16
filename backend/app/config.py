from pydantic_settings import BaseSettings


def _normalize_database_url(url: str) -> str:
    """Use asyncpg driver; Railway often provides postgres:// or postgresql://."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://"):]
    return url


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/workflow_builder"

    def model_post_init(self, __context) -> None:
        self.database_url = _normalize_database_url(self.database_url)
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    # Google OAuth client id for web (used to validate Google ID tokens)
    google_client_id: str = ""
    # Comma-separated origins for CORS (e.g. https://yourapp.railway.app). Empty = localhost only.
    cors_origins: str = ""
    # Log level: DEBUG, INFO, WARNING, ERROR. Used by app/log_config.py.
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
