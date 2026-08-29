"""Tenant and identity persistence foundations."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from platform_app.persistence.base import Base
from platform_app.persistence.conventions import new_id, utc_datetime_type, utc_now


class UniversityStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AccountStatus(StrEnum):
    ACTIVE = "active"
    DELETED = "deleted"


class EnrollmentState(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"


class ModerationState(StrEnum):
    ACTIVE = "active"
    REPLACED = "replaced"


class Role(StrEnum):
    PARTICIPANT = "participant"
    BUILDING_ADMIN = "building_admin"
    PLATFORM_ADMIN = "platform_admin"


def string_enum(enum_type: type[StrEnum], name: str) -> Enum:
    """Persist enum values with stable PostgreSQL enum names."""
    return Enum(
        enum_type,
        name=name,
        values_callable=lambda members: [member.value for member in members],
    )


class MutableRecord:
    """Timestamp and optimistic-version columns for mutable rows."""

    created_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, onupdate=utc_now, nullable=False
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)

    @declared_attr.directive
    def __mapper_args__(cls) -> dict[str, Any]:  # noqa: N805
        return {"version_id_col": cls.version}


class University(MutableRecord, Base):
    __tablename__ = "university"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    timezone: Mapped[str] = mapped_column(String(100), nullable=False)
    roster_reference: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )
    status: Mapped[UniversityStatus] = mapped_column(
        string_enum(UniversityStatus, "university_status"), nullable=False
    )


class UniversityEmailDomain(MutableRecord, Base):
    __tablename__ = "university_email_domain"
    __table_args__ = (
        UniqueConstraint("normalized_domain"),
        CheckConstraint(
            "normalized_domain = lower(normalized_domain)",
            name="normalized_domain_lowercase",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    normalized_domain: Mapped[str] = mapped_column(String(255), nullable=False)


class UserAccount(MutableRecord, Base):
    __tablename__ = "user_account"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    status: Mapped[AccountStatus] = mapped_column(
        string_enum(AccountStatus, "account_status"), nullable=False
    )


class UniversityIdentity(MutableRecord, Base):
    __tablename__ = "university_identity"
    __table_args__ = (
        UniqueConstraint(
            "university_id",
            "normalized_email",
            name="uq_university_identity_university_email",
        ),
        UniqueConstraint(
            "university_id",
            "external_student_reference",
            name="uq_university_identity_university_student_reference",
        ),
        CheckConstraint(
            "normalized_email = lower(normalized_email)",
            name="normalized_email_lowercase",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), nullable=False, index=True
    )
    normalized_email: Mapped[str] = mapped_column(String(320), nullable=False)
    external_student_reference: Mapped[str] = mapped_column(String(200), nullable=False)
    enrollment_state: Mapped[EnrollmentState] = mapped_column(
        string_enum(EnrollmentState, "enrollment_state"), nullable=False
    )


class UserProfile(MutableRecord, Base):
    __tablename__ = "user_profile"
    __table_args__ = (
        UniqueConstraint(
            "university_id",
            "normalized_username",
            name="uq_user_profile_university_username",
        ),
        UniqueConstraint("identity_id"),
        CheckConstraint(
            "normalized_username = lower(normalized_username)",
            name="normalized_username_lowercase",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    identity_id: Mapped[UUID] = mapped_column(
        ForeignKey("university_identity.id", ondelete="CASCADE"), nullable=False
    )
    username: Mapped[str] = mapped_column(String(40), nullable=False)
    normalized_username: Mapped[str] = mapped_column(String(40), nullable=False)
    moderation_state: Mapped[ModerationState] = mapped_column(
        string_enum(ModerationState, "moderation_state"), nullable=False
    )


class RoleAssignment(MutableRecord, Base):
    __tablename__ = "role_assignment"
    __table_args__ = (
        CheckConstraint(
            "(role = 'platform_admin' AND university_id IS NULL "
            "AND building_id IS NULL) "
            "OR (role = 'participant' AND university_id IS NOT NULL "
            "AND building_id IS NULL) "
            "OR (role = 'building_admin' AND university_id IS NOT NULL "
            "AND building_id IS NOT NULL)",
            name="role_scope",
        ),
        UniqueConstraint(
            "account_id",
            "role",
            "university_id",
            "building_id",
            name="uq_role_assignment_scope",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[Role] = mapped_column(string_enum(Role, "role_kind"), nullable=False)
    university_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=True, index=True
    )
    building_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_event"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("university.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    actor_account_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user_account.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(100), nullable=False)
    target_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    before_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    request_correlation_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    occurred_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, nullable=False
    )


class EmailChallenge(Base):
    __tablename__ = "email_challenge"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    normalized_email: Mapped[str] = mapped_column(
        String(320), nullable=False, index=True
    )
    code_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(utc_datetime_type(), nullable=False)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(default=5, nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(
        utc_datetime_type(), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, nullable=False
    )


class AccessSession(Base):
    __tablename__ = "access_session"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    account_id: Mapped[UUID] = mapped_column(
        ForeignKey("user_account.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(utc_datetime_type(), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(
        utc_datetime_type(), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        utc_datetime_type(), default=utc_now, nullable=False
    )


class VerifiedResidence(Base):
    __tablename__ = "verified_residence"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_id)
    university_id: Mapped[UUID] = mapped_column(
        ForeignKey("university.id", ondelete="CASCADE"), nullable=False, index=True
    )
    identity_id: Mapped[UUID] = mapped_column(
        ForeignKey("university_identity.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    building_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    apartment_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    room_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    source_version: Mapped[str] = mapped_column(String(100), nullable=False)
    effective_start: Mapped[datetime] = mapped_column(
        utc_datetime_type(), nullable=False
    )
    effective_end: Mapped[datetime | None] = mapped_column(
        utc_datetime_type(), nullable=True
    )
    verified_at: Mapped[datetime] = mapped_column(utc_datetime_type(), nullable=False)


Index(
    "ix_role_assignment_scope", RoleAssignment.university_id, RoleAssignment.building_id
)
Index(
    "uq_role_assignment_effective_scope",
    RoleAssignment.account_id,
    RoleAssignment.role,
    RoleAssignment.university_id,
    RoleAssignment.building_id,
    unique=True,
    postgresql_nulls_not_distinct=True,
)
