"""Deterministic pseudo-university seed interface."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid5

from sqlalchemy import select
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

SEED_NAMESPACE = UUID("91134630-bb1c-4cb3-8e4f-7836a56f7c74")


def seed_id(seed: int, label: str) -> UUID:
    return uuid5(SEED_NAMESPACE, f"{seed}:{label}")


@dataclass(frozen=True, slots=True)
class SeedSummary:
    university_id: UUID
    active_student_id: UUID
    inactive_student_id: UUID


def seed_demo_roster(session: Session, seed: int = 2026) -> SeedSummary:
    """Seed the minimal deterministic active/inactive contract scenarios."""
    university_id = seed_id(seed, "university")
    existing = session.scalar(
        select(RosterUniversity).where(RosterUniversity.id == university_id)
    )
    if existing is not None:
        return SeedSummary(
            university_id=university_id,
            active_student_id=seed_id(seed, "student-active"),
            inactive_student_id=seed_id(seed, "student-inactive"),
        )

    university = RosterUniversity(
        id=university_id,
        external_reference="demo-university",
        name="Demo University",
        normalized_email_domain="demo.edu",
    )
    building = RosterBuilding(
        id=seed_id(seed, "building"),
        university_id=university.id,
        external_reference="hall-1",
        name="Hall 1",
    )
    apartment = RosterApartment(
        id=seed_id(seed, "apartment"),
        building_id=building.id,
        external_reference="hall-1-a01",
        label="Apartment A01",
    )
    room = RosterRoom(
        id=seed_id(seed, "room"),
        apartment_id=apartment.id,
        external_reference="hall-1-a01-r1",
        label="Room 1",
    )
    active = Student(
        id=seed_id(seed, "student-active"),
        university_id=university.id,
        external_reference="student-active",
        normalized_email="active@demo.edu",
    )
    inactive = Student(
        id=seed_id(seed, "student-inactive"),
        university_id=university.id,
        external_reference="student-inactive",
        normalized_email="inactive@demo.edu",
    )
    start = datetime(2026, 1, 1, tzinfo=UTC)
    ended = datetime(2026, 6, 1, tzinfo=UTC)
    session.add(university)
    session.flush()
    session.add(building)
    session.flush()
    session.add(apartment)
    session.flush()
    session.add(room)
    session.flush()
    session.add_all([active, inactive])
    session.flush()
    session.add_all(
        [
            Enrollment(
                id=seed_id(seed, "enrollment-active"),
                student_id=active.id,
                active=True,
                effective_start=start,
                effective_end=None,
                source_version="roster-v1",
            ),
            ResidenceAssignment(
                id=seed_id(seed, "residence-active"),
                student_id=active.id,
                room_id=room.id,
                effective_start=start,
                effective_end=None,
                source_version="residence-v1",
            ),
            Enrollment(
                id=seed_id(seed, "enrollment-inactive"),
                student_id=inactive.id,
                active=False,
                effective_start=start,
                effective_end=ended,
                source_version="roster-v1",
            ),
        ]
    )
    session.flush()
    return SeedSummary(university.id, active.id, inactive.id)
