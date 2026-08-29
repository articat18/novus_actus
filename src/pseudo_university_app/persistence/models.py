"""Pseudo-university-owned enrolment and residence records."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from pseudo_university_app.persistence.base import Base


def new_id() -> UUID:
    return uuid4()


class RosterUniversity(Base):
    __tablename__ = "roster_university"
    __table_args__ = (
        UniqueConstraint("external_reference"),
        UniqueConstraint("normalized_email_domain"),
        CheckConstraint(
            "normalized_email_domain = lower(normalized_email_domain)",
            name="email_domain_lowercase",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    external_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    normalized_email_domain: Mapped[str] = mapped_column(String(255), nullable=False)


class RosterBuilding(Base):
    __tablename__ = "roster_building"
    __table_args__ = (UniqueConstraint("university_id", "external_reference"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("roster_university.id", ondelete="CASCADE"), nullable=False
    )
    external_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)


class RosterApartment(Base):
    __tablename__ = "roster_apartment"
    __table_args__ = (UniqueConstraint("building_id", "external_reference"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    building_id: Mapped[UUID] = mapped_column(
        ForeignKey("roster_building.id", ondelete="CASCADE"), nullable=False
    )
    external_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)


class RosterRoom(Base):
    __tablename__ = "roster_room"
    __table_args__ = (UniqueConstraint("apartment_id", "external_reference"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    apartment_id: Mapped[UUID] = mapped_column(
        ForeignKey("roster_apartment.id", ondelete="CASCADE"), nullable=False
    )
    external_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)


class Student(Base):
    __tablename__ = "student"
    __table_args__ = (
        UniqueConstraint(
            "university_id",
            "external_reference",
            name="uq_student_university_student_reference",
        ),
        UniqueConstraint(
            "university_id",
            "normalized_email",
            name="uq_student_university_email",
        ),
        CheckConstraint(
            "normalized_email = lower(normalized_email)", name="email_lowercase"
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("roster_university.id", ondelete="CASCADE"), nullable=False
    )
    external_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    normalized_email: Mapped[str] = mapped_column(String(320), nullable=False)


class Enrollment(Base):
    __tablename__ = "enrollment"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"), nullable=False, index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    effective_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    effective_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    source_version: Mapped[str] = mapped_column(String(100), nullable=False)


class ResidenceAssignment(Base):
    __tablename__ = "residence_assignment"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    student_id: Mapped[UUID] = mapped_column(
        ForeignKey("student.id", ondelete="CASCADE"), nullable=False, index=True
    )
    room_id: Mapped[UUID] = mapped_column(
        ForeignKey("roster_room.id", ondelete="RESTRICT"), nullable=False
    )
    effective_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    effective_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    source_version: Mapped[str] = mapped_column(String(100), nullable=False)
