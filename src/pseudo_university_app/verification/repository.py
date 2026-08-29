"""Read-only roster verification queries."""

from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from pseudo_university_app.persistence.models import (
    Enrollment,
    ResidenceAssignment,
    RosterApartment,
    RosterBuilding,
    RosterRoom,
    RosterUniversity,
    Student,
)
from pseudo_university_app.verification.schemas import (
    ResidenceResult,
    VerificationResponse,
    VerificationStatus,
)


class RosterVerificationRepository:
    """Resolve active enrolment and residence at a requested instant."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def verify(self, email: str, at: datetime) -> VerificationResponse:
        if at.utcoffset() is None:
            raise ValueError("verification time must be timezone-aware")
        normalized_email = email.strip().casefold()
        student = self._session.scalar(
            select(Student).where(Student.normalized_email == normalized_email)
        )
        if student is None:
            return VerificationResponse(status=VerificationStatus.NOT_FOUND)

        university = self._session.get(RosterUniversity, student.university_id)
        if university is None:
            raise RuntimeError("student references a missing university")

        active_enrollment = self._session.scalar(
            select(Enrollment).where(
                Enrollment.student_id == student.id,
                Enrollment.active.is_(True),
                Enrollment.effective_start <= at,
                (Enrollment.effective_end.is_(None) | (Enrollment.effective_end > at)),
            )
        )
        residence_row = self._session.execute(
            select(ResidenceAssignment, RosterRoom, RosterApartment, RosterBuilding)
            .join(RosterRoom, ResidenceAssignment.room_id == RosterRoom.id)
            .join(RosterApartment, RosterRoom.apartment_id == RosterApartment.id)
            .join(RosterBuilding, RosterApartment.building_id == RosterBuilding.id)
            .where(
                and_(
                    ResidenceAssignment.student_id == student.id,
                    ResidenceAssignment.effective_start <= at,
                    ResidenceAssignment.effective_end.is_(None)
                    | (ResidenceAssignment.effective_end > at),
                )
            )
        ).one_or_none()
        if active_enrollment is None or residence_row is None:
            return VerificationResponse(
                status=VerificationStatus.INACTIVE,
                university_reference=university.external_reference,
                student_reference=student.external_reference,
            )

        residence, room, apartment, building = residence_row
        return VerificationResponse(
            status=VerificationStatus.ACTIVE,
            university_reference=university.external_reference,
            student_reference=student.external_reference,
            residence=ResidenceResult(
                building_reference=building.external_reference,
                apartment_reference=apartment.external_reference,
                room_reference=room.external_reference,
                source_version=residence.source_version,
            ),
        )
