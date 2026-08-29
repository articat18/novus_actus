"""Public read-only verification API schemas."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class VerificationStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    NOT_FOUND = "not_found"


class ResidenceResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    building_reference: str
    apartment_reference: str
    room_reference: str
    source_version: str


class VerificationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: VerificationStatus
    university_reference: str | None = None
    student_reference: str | None = None
    residence: ResidenceResult | None = None
