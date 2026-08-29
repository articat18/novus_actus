"""REQ-ING-001 and REQ-NFR-002 meter-authentication outcomes."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from platform_app.modules.identity.models import University, UniversityStatus
from platform_app.modules.identity.tenant import TenantAccessDeniedError, TenantContext
from platform_app.modules.ingestion.credentials import (
    MeterCredentialRejectedError,
    MeterCredentialService,
    MeterRateLimitExceededError,
)
from platform_app.modules.ingestion.models import MeterCredential
from platform_app.modules.topology.models import Meter, OperationalState

pytestmark = pytest.mark.integration


def meter_for(session: Session, university: University, name: str) -> Meter:
    meter = Meter(
        university_id=university.id,
        external_reference=name,
        state=OperationalState.ACTIVE,
    )
    session.add(meter)
    session.flush()
    return meter


def test_secret_is_returned_once_hashed_at_rest_and_authenticates(
    db_session: Session,
) -> None:
    university = University(
        name="University A", timezone="Asia/Singapore", status=UniversityStatus.ACTIVE
    )
    db_session.add(university)
    db_session.flush()
    meter = meter_for(db_session, university, "meter-1")
    service = MeterCredentialService(db_session)

    provisioned = service.provision(meter.id, TenantContext(university.id))
    authenticated = service.authenticate(
        meter.id, provisioned.secret, TenantContext(university.id)
    )
    stored = db_session.scalar(
        select(MeterCredential).where(MeterCredential.id == provisioned.credential_id)
    )

    assert authenticated.id == provisioned.credential_id
    assert stored is not None
    assert provisioned.secret.encode() not in stored.secret_hash
    assert not hasattr(stored, "secret")
    assert provisioned.secret not in repr(stored)


def test_revocation_and_rotation_are_independent(db_session: Session) -> None:
    university = University(
        name="University A", timezone="Asia/Singapore", status=UniversityStatus.ACTIVE
    )
    db_session.add(university)
    db_session.flush()
    first_meter = meter_for(db_session, university, "meter-1")
    second_meter = meter_for(db_session, university, "meter-2")
    service = MeterCredentialService(db_session)
    first = service.provision(first_meter.id, TenantContext(university.id))
    second = service.provision(second_meter.id, TenantContext(university.id))

    replacement = service.rotate(
        first.credential_id,
        first_meter.id,
        TenantContext(university.id),
        now=datetime(2026, 1, 1, tzinfo=UTC),
    )

    with pytest.raises(MeterCredentialRejectedError):
        service.authenticate(first_meter.id, first.secret, TenantContext(university.id))
    assert (
        service.authenticate(
            first_meter.id, replacement.secret, TenantContext(university.id)
        ).id
        == replacement.credential_id
    )
    assert (
        service.authenticate(
            second_meter.id, second.secret, TenantContext(university.id)
        ).id
        == second.credential_id
    )


def test_wrong_secret_cross_tenant_and_rate_limit_are_denied(
    db_session: Session,
) -> None:
    first = University(
        name="University A", timezone="Asia/Singapore", status=UniversityStatus.ACTIVE
    )
    second = University(
        name="University B", timezone="Asia/Singapore", status=UniversityStatus.ACTIVE
    )
    db_session.add_all([first, second])
    db_session.flush()
    meter = meter_for(db_session, first, "meter-1")
    now = datetime(2026, 1, 1, tzinfo=UTC)
    service = MeterCredentialService(
        db_session, max_attempts=2, attempt_window=timedelta(minutes=1)
    )
    service.provision(meter.id, TenantContext(first.id))

    with pytest.raises(TenantAccessDeniedError):
        service.authenticate(meter.id, "wrong", TenantContext(second.id), now=now)
    for _ in range(2):
        with pytest.raises(MeterCredentialRejectedError):
            service.authenticate(meter.id, "wrong", TenantContext(first.id), now=now)
    with pytest.raises(MeterRateLimitExceededError):
        service.authenticate(meter.id, "wrong", TenantContext(first.id), now=now)
