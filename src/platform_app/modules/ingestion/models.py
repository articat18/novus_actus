"""Persistence models for authenticated meter ingestion."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    ForeignKeyConstraint,
    LargeBinary,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from platform_app.modules.identity.models import string_enum
from platform_app.persistence.base import Base
from platform_app.persistence.conventions import (
    energy_decimal_type,
    new_id,
    utc_datetime_type,
    utc_now,
)


class ReadingStatus(StrEnum):
    ACCEPTED = "accepted"
    QUARANTINED = "quarantined"
    REJECTED = "rejected"


class CorrectionStatus(StrEnum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    REJECTED = "rejected"


class MeterCredential(Base):
    __tablename__ = "meter_credential"
    __table_args__ = (
        ForeignKeyConstraint(
            ["meter_id", "university_id"],
            ["meter.id", "meter.university_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    meter_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    secret_hash: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    salt: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        utc_datetime_type(), nullable=True
    )
    rotated_from_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)


class MeterAuthenticationAttempt(Base):
    __tablename__ = "meter_authentication_attempt"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    meter_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    credential_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    accepted: Mapped[bool] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, nullable=False, index=True
    )


class ReadingSubmission(Base):
    __tablename__ = "reading_submission"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    meter_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    credential_id: Mapped[UUID] = mapped_column(
        ForeignKey("meter_credential.id", ondelete="RESTRICT"), nullable=False
    )
    correlation_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, nullable=False
    )
    record_count: Mapped[int] = mapped_column(nullable=False)
    accepted_count: Mapped[int] = mapped_column(default=0, nullable=False)
    duplicate_count: Mapped[int] = mapped_column(default=0, nullable=False)
    rejected_count: Mapped[int] = mapped_column(default=0, nullable=False)


class MeterHourlyReading(Base):
    __tablename__ = "meter_hourly_reading"
    __table_args__ = (
        UniqueConstraint(
            "meter_id", "hour_start_utc", name="uq_meter_hourly_reading_meter_hour"
        ),
        ForeignKeyConstraint(
            ["meter_id", "university_id"],
            ["meter.id", "meter.university_id"],
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    meter_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    hour_start_utc: Mapped[datetime] = mapped_column(
        utc_datetime_type(), nullable=False, index=True
    )
    energy_kwh: Mapped[Decimal] = mapped_column(energy_decimal_type(), nullable=False)
    received_at: Mapped[datetime] = mapped_column(utc_datetime_type(), nullable=False)
    status: Mapped[ReadingStatus] = mapped_column(
        string_enum(ReadingStatus, "reading_status"), nullable=False
    )
    credential_id: Mapped[UUID] = mapped_column(
        ForeignKey("meter_credential.id", ondelete="RESTRICT"), nullable=False
    )
    submission_id: Mapped[UUID] = mapped_column(
        ForeignKey("reading_submission.id", ondelete="RESTRICT"), nullable=False
    )


class ReadingCorrection(Base):
    __tablename__ = "reading_correction"
    __table_args__ = (
        UniqueConstraint(
            "reading_id",
            "proposed_energy_kwh",
            name="uq_reading_correction_reading_proposed_energy",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    reading_id: Mapped[UUID] = mapped_column(
        ForeignKey("meter_hourly_reading.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    previous_energy_kwh: Mapped[Decimal] = mapped_column(
        energy_decimal_type(), nullable=False
    )
    proposed_energy_kwh: Mapped[Decimal] = mapped_column(
        energy_decimal_type(), nullable=False
    )
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    proposed_by_credential_id: Mapped[UUID] = mapped_column(
        ForeignKey("meter_credential.id", ondelete="RESTRICT"), nullable=False
    )
    source_submission_id: Mapped[UUID] = mapped_column(
        ForeignKey("reading_submission.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[CorrectionStatus] = mapped_column(
        string_enum(CorrectionStatus, "correction_status"), nullable=False
    )
    proposed_at: Mapped[datetime] = mapped_column(utc_datetime_type(), nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(
        utc_datetime_type(), nullable=True
    )
    decided_by_account_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user_account.id", ondelete="SET NULL"), nullable=True
    )
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
