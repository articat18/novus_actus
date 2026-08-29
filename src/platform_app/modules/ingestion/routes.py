"""HTTP contract for authenticated meter batch ingestion."""

from collections.abc import Callable
from contextlib import AbstractContextManager
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from platform_app.modules.ingestion.batches import (
    BatchRejectedError,
    HourlyBatchIngestionService,
    IncomingHourlyReading,
)

SessionFactory = Callable[[], AbstractContextManager[Session]]


class HourlyReadingRequest(BaseModel):
    meter_id: UUID
    hour_start_utc: Any
    energy_kwh: Any


class BatchIngestionRequest(BaseModel):
    meter_id: UUID
    readings: list[HourlyReadingRequest] = Field(min_length=1, max_length=24)


class RecordOutcomeResponse(BaseModel):
    index: int
    status: str
    reading_id: UUID | None
    correction_id: UUID | None
    reason: str | None


class BatchIngestionResponse(BaseModel):
    submission_id: UUID
    outcomes: list[RecordOutcomeResponse]


def create_ingestion_router(session_factory: SessionFactory) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/v1/meters/readings:batch",
        response_model=BatchIngestionResponse,
        status_code=status.HTTP_200_OK,
    )
    def ingest_batch(
        request: BatchIngestionRequest,
        meter_secret: Annotated[str, Header(alias="X-Meter-Secret")],
        correlation_id: Annotated[str | None, Header(alias="X-Correlation-ID")] = None,
    ) -> BatchIngestionResponse:
        try:
            with session_factory() as session:
                outcome = HourlyBatchIngestionService(session).ingest(
                    request.meter_id,
                    meter_secret,
                    [
                        IncomingHourlyReading(
                            reading.meter_id,
                            reading.hour_start_utc,
                            reading.energy_kwh,
                        )
                        for reading in request.readings
                    ],
                    correlation_id=correlation_id,
                )
                session.commit()
        except PermissionError as error:
            raise HTTPException(
                status_code=401, detail="meter authentication denied"
            ) from error
        except BatchRejectedError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        return BatchIngestionResponse(
            submission_id=outcome.submission_id,
            outcomes=[
                RecordOutcomeResponse(
                    index=item.index,
                    status=item.status.value,
                    reading_id=item.reading_id,
                    correction_id=item.correction_id,
                    reason=item.reason,
                )
                for item in outcome.outcomes
            ],
        )

    return router
