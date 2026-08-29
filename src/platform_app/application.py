"""Platform ASGI application factory."""

from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from platform_app.adapters.university_http import HttpUniversityVerificationClient
from platform_app.modules.identity.api import (
    IdentityRuntime,
    SessionFactory,
    create_identity_router,
)
from platform_app.modules.identity.ports import InMemoryEmailCodeSender
from platform_app.settings import PlatformSettings


def create_app(
    settings: PlatformSettings | None = None,
    session_factory: SessionFactory | None = None,
    identity_runtime: IdentityRuntime | None = None,
) -> FastAPI:
    """Create the platform application after validating its environment."""
    resolved_settings = settings or PlatformSettings()
    if session_factory is None:
        engine = create_engine(resolved_settings.database_url)
        session_factory = sessionmaker(engine, class_=Session)
    if identity_runtime is None:
        identity_runtime = IdentityRuntime(
            university_gateway=HttpUniversityVerificationClient(
                str(resolved_settings.university_api_url)
            ),
            email_sender=InMemoryEmailCodeSender(),
            challenge_hmac_key=resolved_settings.challenge_hmac_key.get_secret_value(),
            session_hmac_key=resolved_settings.session_hmac_key.get_secret_value(),
        )
    app = FastAPI(title=resolved_settings.service_name, version="0.1.0")
    app.state.settings = resolved_settings
    app.include_router(create_identity_router(session_factory, identity_runtime))
    return app
