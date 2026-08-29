"""Read-only verification HTTP interface."""

from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from pseudo_university_app.verification.repository import (
    RosterVerificationRepository,
)
from pseudo_university_app.verification.schemas import VerificationResponse

SessionFactory = Callable[[], Session]


def create_verification_router(session_factory: SessionFactory) -> APIRouter:
    router = APIRouter(prefix="/v1/verification", tags=["verification"])

    def session_dependency() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    @router.get("/residents", response_model=VerificationResponse)
    def verify_resident(
        email: Annotated[str, Query(min_length=3, max_length=320)],
        at: Annotated[datetime, Query()],
        session: Annotated[Session, Depends(session_dependency)],
    ) -> VerificationResponse:
        try:
            return RosterVerificationRepository(session).verify(email, at)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    return router
