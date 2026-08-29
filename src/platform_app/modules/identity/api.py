"""Passwordless identity HTTP API."""

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from platform_app.modules.identity.ports import EmailCodeSender
from platform_app.modules.identity.service import (
    ChallengeRateLimitError,
    IdentityService,
    InvalidChallengeError,
    InvalidSessionError,
    RosterIneligibleError,
    UniversityDomainError,
    UsernameUnavailableError,
)
from platform_app.modules.university.contracts import UniversityVerificationGateway

SessionFactory = Callable[[], Session]


@dataclass(frozen=True, slots=True)
class IdentityRuntime:
    university_gateway: UniversityVerificationGateway
    email_sender: EmailCodeSender
    challenge_hmac_key: str
    session_hmac_key: str
    clock: Callable[[], datetime] | None = None
    code_factory: Callable[[], str] | None = None
    token_factory: Callable[[], str] | None = None


class ChallengeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)


class ChallengeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_id: UUID
    expires_at: datetime
    message: str


class ChallengeVerification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_id: UUID
    code: str = Field(pattern=r"^[0-9]{6}$")
    username: str


class SessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    username: str
    roles: list[str]


class UsernameChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str


class UsernameResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str


def create_identity_router(
    session_factory: SessionFactory, runtime: IdentityRuntime
) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["identity"])

    def session_dependency() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    def service_for(session: Session) -> IdentityService:
        return IdentityService(
            session,
            runtime.university_gateway,
            runtime.email_sender,
            runtime.challenge_hmac_key,
            runtime.session_hmac_key,
            clock=runtime.clock,
            code_factory=runtime.code_factory,
            token_factory=runtime.token_factory,
        )

    @router.post(
        "/auth/challenges",
        response_model=ChallengeResponse,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def request_challenge(
        body: ChallengeRequest,
        session: Annotated[Session, Depends(session_dependency)],
    ) -> ChallengeResponse:
        service = service_for(session)
        try:
            issued = service.request_challenge(body.email)
            session.commit()
        except UniversityDomainError as error:
            session.rollback()
            raise HTTPException(status_code=422, detail=str(error)) from error
        except ChallengeRateLimitError as error:
            session.rollback()
            raise HTTPException(status_code=429, detail=str(error)) from error
        return ChallengeResponse(
            challenge_id=issued.challenge_id,
            expires_at=issued.expires_at,
            message="A verification code has been sent to the eligible address.",
        )

    @router.post("/auth/challenges/verify", response_model=SessionResponse)
    def verify_challenge(
        body: ChallengeVerification,
        session: Annotated[Session, Depends(session_dependency)],
    ) -> SessionResponse:
        service = service_for(session)
        try:
            activated = service.verify_challenge(
                body.challenge_id, body.code, body.username
            )
            session.commit()
        except InvalidChallengeError as error:
            session.commit()
            raise HTTPException(status_code=400, detail=str(error)) from error
        except RosterIneligibleError as error:
            session.commit()
            raise HTTPException(status_code=403, detail=str(error)) from error
        except UsernameUnavailableError as error:
            session.rollback()
            raise HTTPException(status_code=409, detail=str(error)) from error
        return SessionResponse(
            access_token=activated.access_token,
            expires_at=activated.expires_at,
            username=activated.username,
            roles=[role.value for role in activated.roles],
        )

    @router.patch("/me/username", response_model=UsernameResponse)
    def change_username(
        body: UsernameChange,
        session: Annotated[Session, Depends(session_dependency)],
        authorization: Annotated[str | None, Header()] = None,
    ) -> UsernameResponse:
        if authorization is None or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="access token is required")
        service = service_for(session)
        try:
            principal = service.principal_for_token(
                authorization.removeprefix("Bearer ")
            )
            username = service.change_username(principal, body.username)
            session.commit()
        except InvalidSessionError as error:
            session.rollback()
            raise HTTPException(status_code=401, detail=str(error)) from error
        except UsernameUnavailableError as error:
            session.rollback()
            raise HTTPException(status_code=409, detail=str(error)) from error
        return UsernameResponse(username=username)

    return router
