"""Environment-backed pseudo-university configuration."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PseudoUniversitySettings(BaseSettings):
    """Required startup settings for the isolated university deployable."""

    model_config = SettingsConfigDict(
        env_prefix="PSEUDO_UNIVERSITY_",
        extra="ignore",
        frozen=True,
    )

    database_url: str = Field(min_length=1)
    service_name: str = "Pseudo University Verification"
