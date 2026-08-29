"""Pseudo-university ASGI application factory."""

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from pseudo_university_app.settings import PseudoUniversitySettings
from pseudo_university_app.verification.api import (
    SessionFactory,
    create_verification_router,
)


def create_app(
    settings: PseudoUniversitySettings | None = None,
    session_factory: SessionFactory | None = None,
) -> FastAPI:
    """Create the pseudo-university app after validating its environment."""
    resolved_settings = settings or PseudoUniversitySettings()
    if session_factory is None:
        engine = create_engine(resolved_settings.database_url)
        session_factory = sessionmaker(engine, class_=Session)
    app = FastAPI(title=resolved_settings.service_name, version="0.1.0")
    app.state.settings = resolved_settings
    app.include_router(create_verification_router(session_factory))
    return app
