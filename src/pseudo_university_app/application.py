"""Pseudo-university ASGI application factory."""

from fastapi import FastAPI

from pseudo_university_app.settings import PseudoUniversitySettings


def create_app(settings: PseudoUniversitySettings | None = None) -> FastAPI:
    """Create the pseudo-university app after validating its environment."""
    resolved_settings = settings or PseudoUniversitySettings()
    app = FastAPI(title=resolved_settings.service_name, version="0.1.0")
    app.state.settings = resolved_settings
    return app
