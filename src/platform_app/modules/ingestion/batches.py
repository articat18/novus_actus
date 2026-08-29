"""Validated, fixed-precision and idempotent hourly batch ingestion."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from platform_app.modules.identity.tenant import TenantContext
from platform_app.modules.ingestion.credentials import MeterCredentialService
from platform_app.modules.ingestion.models import (
    MeterHourlyReading,
    ReadingStatus,
    ReadingSubmission,
)
from platform_app.modules.topology.models import Meter
from platform_app.persistence.conventions import new_id, quantize_energy, utc_now


class BatchRejectedError(ValueError):
    """The batch envelope cannot be processed."""


class RecordOutcomeStatus(StrEnum):
    ACCEPTED = "accepted"
    DUPLICATE = "duplicate"
    CHANGED_DUPLICATE = "changed_duplicate"
    REJECTED = "rejected"


@dataclass(frozen=True, slots=True)
class IncomingHourlyReading:
    meter_id: UUID
    hour_start_utc: Any
    energy_kwh: Any


@dataclass(frozen=True, slots=True)
class RecordOutcome:
    index: int
    status: RecordOutcomeStatus
    reading_id: UUID | None = None
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class BatchOutcome:
    submission_id: UUID
    outcomes: tuple[RecordOutcome, ...]


class HourlyBatchIngestionService:
    def __init__(
        self,
        session: Session,
        *,
        max_future_skew: timedelta = timedelta(minutes=5),
    ) -> None:
        self._session = session
        self._credentials = MeterCredentialService(session)
        self._max_future_skew = max_future_skew

    def ingest(
        self,
        meter_id: UUID,
        secret: str,
        records: list[IncomingHourlyReading],
        *,
        now: datetime | None = None,
        correlation_id: str | None = None,
    ) -> BatchOutcome:
        if not records or len(records) > 24:
            raise BatchRejectedError("a batch must contain between 1 and 24 records")
        instant = (now or utc_now()).astimezone(UTC)
        meter = self._session.get(Meter, meter_id)
        if meter is None:
            raise PermissionError("meter authentication denied")
        credential = self._credentials.authenticate(
            meter_id, secret, TenantContext(meter.university_id), now=instant
        )
        submission = ReadingSubmission(
            university_id=meter.university_id,
            meter_id=meter.id,
            credential_id=credential.id,
            correlation_id=correlation_id,
            received_at=instant,
            record_count=len(records),
        )
        self._session.add(submission)
        self._session.flush()

        outcomes = tuple(
            self._ingest_record(
                index, record, meter, credential.id, submission, instant
            )
            for index, record in enumerate(records)
        )
        submission.accepted_count = sum(
            outcome.status is RecordOutcomeStatus.ACCEPTED for outcome in outcomes
        )
        submission.duplicate_count = sum(
            outcome.status
            in {RecordOutcomeStatus.DUPLICATE, RecordOutcomeStatus.CHANGED_DUPLICATE}
            for outcome in outcomes
        )
        submission.rejected_count = sum(
            outcome.status is RecordOutcomeStatus.REJECTED for outcome in outcomes
        )
        self._session.flush()
        return BatchOutcome(submission.id, outcomes)

    def _ingest_record(
        self,
        index: int,
        record: IncomingHourlyReading,
        meter: Meter,
        credential_id: UUID,
        submission: ReadingSubmission,
        now: datetime,
    ) -> RecordOutcome:
        try:
            hour = self._parse_hour(record.hour_start_utc, now)
            energy = self._parse_energy(record.energy_kwh)
            if record.meter_id != meter.id:
                raise ValueError("record meter does not match authenticated meter")
        except (InvalidOperation, TypeError, ValueError) as error:
            return RecordOutcome(index, RecordOutcomeStatus.REJECTED, reason=str(error))

        reading_id = new_id()
        statement = (
            insert(MeterHourlyReading)
            .values(
                id=reading_id,
                university_id=meter.university_id,
                meter_id=meter.id,
                hour_start_utc=hour,
                energy_kwh=energy,
                received_at=now,
                status=ReadingStatus.ACCEPTED,
                credential_id=credential_id,
                submission_id=submission.id,
            )
            .on_conflict_do_nothing(index_elements=["meter_id", "hour_start_utc"])
            .returning(MeterHourlyReading.id)
        )
        inserted_id = self._session.scalar(statement)
        if inserted_id is not None:
            return RecordOutcome(index, RecordOutcomeStatus.ACCEPTED, inserted_id)

        existing = self._session.scalar(
            select(MeterHourlyReading).where(
                MeterHourlyReading.meter_id == meter.id,
                MeterHourlyReading.hour_start_utc == hour,
            )
        )
        if existing is None:
            raise RuntimeError("unique conflict did not resolve to an existing reading")
        status = (
            RecordOutcomeStatus.DUPLICATE
            if existing.energy_kwh == energy
            else RecordOutcomeStatus.CHANGED_DUPLICATE
        )
        return RecordOutcome(index, status, existing.id)

    def _parse_hour(self, value: Any, now: datetime) -> datetime:
        if isinstance(value, str):
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif isinstance(value, datetime):
            parsed = value
        else:
            raise TypeError("hour_start_utc must be an ISO-8601 timestamp")
        if parsed.tzinfo is None:
            raise ValueError("hour_start_utc must include a timezone")
        parsed = parsed.astimezone(UTC)
        if parsed.minute or parsed.second or parsed.microsecond:
            raise ValueError("hour_start_utc must be an exact UTC hour")
        if parsed > now + self._max_future_skew:
            raise ValueError("hour_start_utc is impermissibly future-dated")
        return parsed

    @staticmethod
    def _parse_energy(value: Any) -> Decimal:
        energy = Decimal(str(value))
        if not energy.is_finite() or energy < 0:
            raise ValueError("energy_kwh must be finite and non-negative")
        return quantize_energy(energy)
