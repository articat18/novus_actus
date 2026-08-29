"""Tenant-owned dorm topology with non-overlapping effective assignments."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from platform_app.modules.identity.models import MutableRecord, string_enum
from platform_app.persistence.base import Base
from platform_app.persistence.conventions import new_id, utc_datetime_type


class OperationalState(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Building(MutableRecord, Base):
    __tablename__ = "building"
    __table_args__ = (UniqueConstraint("id", "university_id"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)


class Apartment(MutableRecord, Base):
    __tablename__ = "apartment"
    __table_args__ = (
        UniqueConstraint("id", "university_id"),
        ForeignKeyConstraint(
            ["building_id", "university_id"],
            ["building.id", "building.university_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("building_id", "label"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    building_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)


class Room(MutableRecord, Base):
    __tablename__ = "room"
    __table_args__ = (
        ForeignKeyConstraint(
            ["apartment_id", "university_id"],
            ["apartment.id", "apartment.university_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("apartment_id", "label"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    apartment_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)


class FuseBox(MutableRecord, Base):
    __tablename__ = "fuse_box"
    __table_args__ = (
        UniqueConstraint("id", "university_id"),
        UniqueConstraint("university_id", "external_reference"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    external_reference: Mapped[str] = mapped_column(String(200), nullable=False)
    state: Mapped[OperationalState] = mapped_column(
        string_enum(OperationalState, "fuse_box_operational_state"), nullable=False
    )


class Meter(MutableRecord, Base):
    __tablename__ = "meter"
    __table_args__ = (
        UniqueConstraint("id", "university_id"),
        UniqueConstraint("university_id", "external_reference"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    external_reference: Mapped[str] = mapped_column(String(200), nullable=False)
    state: Mapped[OperationalState] = mapped_column(
        string_enum(OperationalState, "meter_operational_state"), nullable=False
    )


class FuseBoxApartmentAssignment(Base):
    __tablename__ = "fuse_box_apartment_assignment"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    fuse_box_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    apartment_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    effective_from: Mapped[datetime] = mapped_column(
        utc_datetime_type(), nullable=False
    )
    effective_until: Mapped[datetime | None] = mapped_column(
        utc_datetime_type(), nullable=True
    )
    __table_args__ = (
        ForeignKeyConstraint(
            ["fuse_box_id", "university_id"],
            ["fuse_box.id", "fuse_box.university_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["apartment_id", "university_id"],
            ["apartment.id", "apartment.university_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "effective_until IS NULL OR effective_until > effective_from",
            name="positive_effective_interval",
        ),
        ExcludeConstraint(
            (fuse_box_id, "="),
            (func.tstzrange(effective_from, effective_until, "[)"), "&&"),
            name="ex_fuse_box_assignment_no_overlap",
            using="gist",
        ),
    )


class MeterFuseBoxAssignment(Base):
    __tablename__ = "meter_fuse_box_assignment"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    meter_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    fuse_box_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    effective_from: Mapped[datetime] = mapped_column(
        utc_datetime_type(), nullable=False
    )
    effective_until: Mapped[datetime | None] = mapped_column(
        utc_datetime_type(), nullable=True
    )
    __table_args__ = (
        ForeignKeyConstraint(
            ["meter_id", "university_id"],
            ["meter.id", "meter.university_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["fuse_box_id", "university_id"],
            ["fuse_box.id", "fuse_box.university_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "effective_until IS NULL OR effective_until > effective_from",
            name="positive_effective_interval",
        ),
        ExcludeConstraint(
            (meter_id, "="),
            (func.tstzrange(effective_from, effective_until, "[)"), "&&"),
            name="ex_meter_assignment_no_overlap",
            using="gist",
        ),
    )
