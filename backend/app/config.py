from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/workflow_builder"
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    # Comma-separated origins for CORS (e.g. https://yourapp.railway.app). Empty = localhost only.
    cors_origins: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
