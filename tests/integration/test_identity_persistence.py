"""REQ-TEN-001 and persistence-convention integration outcomes."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy import Column, MetaData, Table, insert, select
from sqlalchemy.orm import Session

from platform_app.modules.identity.models import (
    AccountStatus,
    AuditEvent,
    EnrollmentState,
    ModerationState,
    University,
    UniversityIdentity,
    UniversityStatus,
    UserAccount,
    UserProfile,
)
from platform_app.modules.identity.tenant import (
    IdentityRepository,
    PlatformTenantOverride,
    TenantAccessDeniedError,
    TenantContext,
)
from platform_app.persistence.conventions import (
    energy_decimal_type,
    utc_datetime_type,
)

pytestmark = pytest.mark.integration


def add_profile(session: Session, university: University, username: str) -> UserProfile:
    account = UserAccount(status=AccountStatus.ACTIVE)
    session.add(account)
    session.flush()
    identity = UniversityIdentity(
        university_id=university.id,
        account_id=account.id,
        normalized_email=f"{username}@example.edu",
        external_student_reference=f"student-{username}",
        enrollment_state=EnrollmentState.ACTIVE,
    )
    session.add(identity)
    session.flush()
    profile = UserProfile(
        university_id=university.id,
        identity_id=identity.id,
        username=username,
        normalized_username=username.lower(),
        moderation_state=ModerationState.ACTIVE,
    )
    session.add(profile)
    session.flush()
    return profile


def add_university(session: Session, name: str) -> University:
    university = University(
        name=name, timezone="Asia/Singapore", status=UniversityStatus.ACTIVE
    )
    session.add(university)
    session.flush()
    return university


def test_tenant_repository_denies_guessed_cross_tenant_identifier(
    db_session: Session,
) -> None:
    university_a = add_university(db_session, "University A")
    university_b = add_university(db_session, "University B")
    profile_a = add_profile(db_session, university_a, "alice")
    profile_b = add_profile(db_session, university_b, "bob")
    repository = IdentityRepository(db_session)

    visible = repository.list_profiles(TenantContext(university_a.id))

    assert [profile.id for profile in visible] == [profile_a.id]
    with pytest.raises(TenantAccessDeniedError):
        repository.get_profile(profile_b.id, TenantContext(university_a.id))


def test_platform_override_is_explicit_and_audited(db_session: Session) -> None:
    university = add_university(db_session, "University B")
    profile = add_profile(db_session, university, "bob")
    operator = UserAccount(status=AccountStatus.ACTIVE)
    db_session.add(operator)
    db_session.flush()
    repository = IdentityRepository(db_session)
    scope = PlatformTenantOverride(
        actor_account_id=operator.id,
        target_university_id=university.id,
        reason="investigate support ticket T-42",
    )

    selected = repository.get_profile(profile.id, scope)

    audit = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.action == "platform.cross_tenant.read",
            AuditEvent.target_id == profile.id,
        )
    )
    assert selected.id == profile.id
    assert audit is not None
    assert audit.actor_account_id == operator.id
    assert audit.university_id == university.id
    assert audit.reason == "investigate support ticket T-42"
    assert audit.after_state == {"selected_university_id": str(university.id)}


def test_platform_override_rejects_missing_reason() -> None:
    with pytest.raises(ValueError, match="requires a reason"):
        PlatformTenantOverride(UUID(int=1), UUID(int=2), "  ")


def test_decimal_and_timezone_conventions_round_trip_exactly(
    db_session: Session,
) -> None:
    metadata = MetaData()
    probe = Table(
        "persistence_convention_probe",
        metadata,
        Column("amount", energy_decimal_type(), nullable=False),
        Column("occurred_at", utc_datetime_type(), nullable=False),
    )
    probe.create(db_session.connection())
    expected_amount = Decimal("123.456789")
    expected_time = datetime.fromisoformat("2026-08-29T12:34:56+00:00")
    db_session.execute(
        insert(probe).values(amount=expected_amount, occurred_at=expected_time)
    )

    actual_amount, actual_time = db_session.execute(
        select(probe.c.amount, probe.c.occurred_at)
    ).one()

    assert actual_amount == expected_amount
    assert actual_time == expected_time
    assert actual_time.tzinfo is not None
