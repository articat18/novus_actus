"""Platform ASGI application factory."""

from fastapi import FastAPI

from platform_app.settings import PlatformSettings


def create_app(settings: PlatformSettings | None = None) -> FastAPI:
    """Create the platform application after validating its environment."""
    resolved_settings = settings or PlatformSettings()
    app = FastAPI(title=resolved_settings.service_name, version="0.1.0")
    app.state.settings = resolved_settings
    return app
