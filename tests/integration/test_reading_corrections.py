"""REQ-ING-002 and REQ-ADM-001 changed-duplicate correction outcomes."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from platform_app.modules.identity.models import (
    AuditEvent,
    University,
    UniversityStatus,
)
from platform_app.modules.identity.tenant import TenantContext
from platform_app.modules.ingestion.batches import (
    HourlyBatchIngestionService,
    IncomingHourlyReading,
    RecordOutcomeStatus,
)
from platform_app.modules.ingestion.credentials import MeterCredentialService
from platform_app.modules.ingestion.models import (
    MeterHourlyReading,
    ReadingCorrection,
)
from platform_app.modules.topology.models import Meter, OperationalState

pytestmark = pytest.mark.integration


def provisioned_meter(session: Session) -> tuple[University, Meter, str]:
    university = University(
        name="Corrections University",
        timezone="Asia/Singapore",
        status=UniversityStatus.ACTIVE,
    )
    session.add(university)
    session.flush()
    meter = Meter(
        university_id=university.id,
        external_reference="correction-meter",
        state=OperationalState.ACTIVE,
    )
    session.add(meter)
    session.flush()
    secret = (
        MeterCredentialService(session)
        .provision(meter.id, TenantContext(university.id))
        .secret
    )
    return university, meter, secret


def test_identical_retry_is_noop_and_changed_retry_creates_audited_proposal(
    db_session: Session,
) -> None:
    _, meter, secret = provisioned_meter(db_session)
    hour = datetime(2026, 1, 1, tzinfo=UTC)
    now = datetime(2026, 1, 2, tzinfo=UTC)
    service = HourlyBatchIngestionService(db_session)
    original = IncomingHourlyReading(meter.id, hour, "1.250000")
    service.ingest(meter.id, secret, [original], now=now)

    identical = service.ingest(meter.id, secret, [original], now=now).outcomes[0]
    changed = service.ingest(
        meter.id,
        secret,
        [IncomingHourlyReading(meter.id, hour, "0.750000")],
        now=now,
        correlation_id="changed-1",
    ).outcomes[0]

    reading = db_session.scalar(select(MeterHourlyReading))
    corrections = list(db_session.scalars(select(ReadingCorrection)))
    audit = db_session.scalar(
        select(AuditEvent).where(AuditEvent.action == "reading.correction.proposed")
    )
    assert identical.status is RecordOutcomeStatus.DUPLICATE
    assert identical.correction_id is None
    assert changed.status is RecordOutcomeStatus.CHANGED_DUPLICATE
    assert len(corrections) == 1
    assert changed.correction_id == corrections[0].id
    assert corrections[0].previous_energy_kwh == Decimal("1.250000")
    assert corrections[0].proposed_energy_kwh == Decimal("0.750000")
    assert reading is not None and reading.energy_kwh == Decimal("1.250000")
    assert audit is not None
    assert audit.target_id == corrections[0].id
    assert audit.before_state == {"energy_kwh": "1.250000"}
    assert audit.after_state is not None
    assert audit.after_state["energy_kwh"] == "0.750000"
    assert audit.request_correlation_id == "changed-1"


def test_concurrent_changed_retries_create_one_proposal_and_never_update_reading(
    postgres_engine: Engine,
) -> None:
    sessions = sessionmaker(postgres_engine, expire_on_commit=False)
    hour = datetime(2026, 1, 1, tzinfo=UTC)
    now = datetime(2026, 1, 2, tzinfo=UTC)
    with sessions.begin() as setup:
        _, meter, secret = provisioned_meter(setup)
        meter_id = meter.id
        HourlyBatchIngestionService(setup).ingest(
            meter_id,
            secret,
            [IncomingHourlyReading(meter_id, hour, "2.000000")],
            now=now,
        )

    def submit_change() -> RecordOutcomeStatus:
        with sessions.begin() as session:
            outcome = HourlyBatchIngestionService(session).ingest(
                meter_id,
                secret,
                [IncomingHourlyReading(meter_id, hour, "1.000000")],
                now=now,
            )
            return outcome.outcomes[0].status

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(lambda _: submit_change(), range(2)))

    with sessions() as verification:
        correction_count = verification.scalar(
            select(func.count()).select_from(ReadingCorrection)
        )
        audit_count = verification.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.action == "reading.correction.proposed")
        )
        accepted_energy = verification.scalar(
            select(MeterHourlyReading.energy_kwh).where(
                MeterHourlyReading.meter_id == meter_id,
                MeterHourlyReading.hour_start_utc == hour,
            )
        )
    assert outcomes == [
        RecordOutcomeStatus.CHANGED_DUPLICATE,
        RecordOutcomeStatus.CHANGED_DUPLICATE,
    ]
    assert correction_count == 1
    assert audit_count == 1
    assert accepted_energy == Decimal("2.000000")
