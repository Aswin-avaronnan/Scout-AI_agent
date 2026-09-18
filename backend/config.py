from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    port: int = 7860
    allowed_origins: str = "*"
    environment: str = "production"
    sentry_dsn: Optional[str] = None
    rate_limit_scout: str = "10/minute"
    rate_limit_simulate: str = "20/minute"
    rate_limit_upload: str = "10/minute"
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def parsed_origins(self) -> List[str]:
        if self.allowed_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

settings = Settings()
