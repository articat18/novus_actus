"""REQ-ING-001/002 fixed-precision, idempotent batch outcomes."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import FastAPI
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from platform_app.modules.identity.models import University, UniversityStatus
from platform_app.modules.identity.tenant import TenantContext
from platform_app.modules.ingestion.batches import (
    BatchRejectedError,
    HourlyBatchIngestionService,
    IncomingHourlyReading,
    RecordOutcomeStatus,
)
from platform_app.modules.ingestion.credentials import MeterCredentialService
from platform_app.modules.ingestion.models import MeterHourlyReading, ReadingSubmission
from platform_app.modules.ingestion.routes import create_ingestion_router
from platform_app.modules.topology.models import Meter, OperationalState

pytestmark = pytest.mark.integration


def provisioned_meter(session: Session) -> tuple[University, Meter, str]:
    suffix = uuid4().hex
    university = University(
        name=f"University {suffix}",
        timezone="Asia/Singapore",
        status=UniversityStatus.ACTIVE,
    )
    session.add(university)
    session.flush()
    meter = Meter(
        university_id=university.id,
        external_reference=f"meter-{suffix}",
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


def test_valid_24_hour_batch_records_server_time_and_exact_decimals(
    db_session: Session,
) -> None:
    _, meter, secret = provisioned_meter(db_session)
    received_at = datetime(2026, 1, 2, tzinfo=UTC)
    records = [
        IncomingHourlyReading(
            meter.id,
            datetime(2026, 1, 1, hour, tzinfo=UTC),
            f"{hour}.123456",
        )
        for hour in range(24)
    ]

    result = HourlyBatchIngestionService(db_session).ingest(
        meter.id, secret, records, now=received_at, correlation_id="batch-1"
    )

    stored = list(
        db_session.scalars(
            select(MeterHourlyReading).order_by(MeterHourlyReading.hour_start_utc)
        )
    )
    submission = db_session.get(ReadingSubmission, result.submission_id)
    assert len(stored) == 24
    assert all(item.status is RecordOutcomeStatus.ACCEPTED for item in result.outcomes)
    assert stored[7].energy_kwh == Decimal("7.123456")
    assert stored[7].received_at == received_at
    assert stored[7].hour_start_utc.tzinfo is not None
    assert submission is not None and submission.accepted_count == 24


def test_malformed_negative_future_non_hour_and_other_meter_are_per_record_rejections(
    db_session: Session,
) -> None:
    _, meter, secret = provisioned_meter(db_session)
    now = datetime(2026, 1, 2, tzinfo=UTC)
    records = [
        IncomingHourlyReading(meter.id, "not-a-time", "1"),
        IncomingHourlyReading(meter.id, "2026-01-01T01:00:00Z", "-1"),
        IncomingHourlyReading(meter.id, "2026-01-02T01:00:00Z", "1"),
        IncomingHourlyReading(meter.id, "2026-01-01T01:15:00Z", "1"),
        IncomingHourlyReading(uuid4(), "2026-01-01T02:00:00Z", "1"),
        IncomingHourlyReading(meter.id, "2026-01-01T03:00:00Z", "0.5"),
    ]

    result = HourlyBatchIngestionService(db_session).ingest(
        meter.id, secret, records, now=now
    )

    assert [item.status for item in result.outcomes] == [
        RecordOutcomeStatus.REJECTED,
        RecordOutcomeStatus.REJECTED,
        RecordOutcomeStatus.REJECTED,
        RecordOutcomeStatus.REJECTED,
        RecordOutcomeStatus.REJECTED,
        RecordOutcomeStatus.ACCEPTED,
    ]
    assert db_session.scalar(select(func.count()).select_from(MeterHourlyReading)) == 1


def test_batch_size_and_http_contract_limit_to_24(db_session: Session) -> None:
    _, meter, secret = provisioned_meter(db_session)
    records = [
        IncomingHourlyReading(meter.id, datetime(2026, 1, 1, tzinfo=UTC), "1")
    ] * 25
    with pytest.raises(BatchRejectedError):
        HourlyBatchIngestionService(db_session).ingest(meter.id, secret, records)

    app = FastAPI()
    app.include_router(create_ingestion_router(lambda: db_session))
    schema = app.openapi()
    readings_schema = schema["components"]["schemas"]["BatchIngestionRequest"][
        "properties"
    ]["readings"]
    assert readings_schema["maxItems"] == 24
    assert readings_schema["minItems"] == 1


def test_concurrent_identical_retries_create_one_reading(
    postgres_engine: Engine,
) -> None:
    sessions = sessionmaker(postgres_engine, expire_on_commit=False)
    with sessions.begin() as setup:
        _, meter, secret = provisioned_meter(setup)
        meter_id = meter.id
    record = IncomingHourlyReading(
        meter_id, datetime(2026, 1, 1, tzinfo=UTC), "2.500000"
    )

    def submit() -> RecordOutcomeStatus:
        with sessions.begin() as session:
            return (
                HourlyBatchIngestionService(session)
                .ingest(
                    meter_id,
                    secret,
                    [record],
                    now=datetime(2026, 1, 2, tzinfo=UTC),
                )
                .outcomes[0]
                .status
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(lambda _: submit(), range(2)))

    with sessions() as session:
        count = session.scalar(
            select(func.count())
            .select_from(MeterHourlyReading)
            .where(MeterHourlyReading.meter_id == meter_id)
        )
    assert sorted(outcomes) == [
        RecordOutcomeStatus.ACCEPTED,
        RecordOutcomeStatus.DUPLICATE,
    ]
    assert count == 1
