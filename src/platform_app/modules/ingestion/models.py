"""Persistence models for authenticated meter ingestion."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKeyConstraint, LargeBinary, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from platform_app.persistence.base import Base
from platform_app.persistence.conventions import new_id, utc_datetime_type, utc_now


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
