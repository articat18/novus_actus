"""Environment-backed platform configuration."""

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PlatformDatabaseSettings(BaseSettings):
    """Database-only settings used by the platform migration process."""

    model_config = SettingsConfigDict(
        env_prefix="PLATFORM_",
        extra="ignore",
        frozen=True,
    )

    database_url: str = Field(min_length=1)


class PlatformSettings(PlatformDatabaseSettings):
    """Required startup settings for the platform deployable."""

    university_api_url: AnyHttpUrl
    service_name: str = "Energy Leaderboard Platform"
