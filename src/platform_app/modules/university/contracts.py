"""Platform-owned contract for read-only university verification."""

from datetime import datetime
from enum import StrEnum
from typing import Protocol

from pydantic import BaseModel, ConfigDict


class VerificationStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    NOT_FOUND = "not_found"


class VerifiedResidence(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    building_reference: str
    apartment_reference: str
    room_reference: str
    source_version: str


class UniversityVerification(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: VerificationStatus
    university_reference: str | None = None
    student_reference: str | None = None
    residence: VerifiedResidence | None = None


class UniversityVerificationGateway(Protocol):
    def verify_resident(self, email: str, at: datetime) -> UniversityVerification:
        """Return authoritative enrolment and effective residence."""
