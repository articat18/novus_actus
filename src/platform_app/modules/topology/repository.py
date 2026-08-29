"""Tenant-scoped historical topology resolution."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from platform_app.modules.identity.tenant import TenantAccessDeniedError, TenantContext
from platform_app.modules.topology.models import (
    FuseBoxApartmentAssignment,
    Meter,
    MeterFuseBoxAssignment,
)


class TopologyRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_meter(self, meter_id: UUID, scope: TenantContext) -> Meter:
        meter = self._session.get(Meter, meter_id)
        if meter is None:
            raise LookupError("meter not found")
        if meter.university_id != scope.university_id:
            raise TenantAccessDeniedError("meter belongs to another university")
        return meter

    def resolve_meter_fuse_box(
        self, meter_id: UUID, at: datetime, scope: TenantContext
    ) -> MeterFuseBoxAssignment:
        self.get_meter(meter_id, scope)
        assignment = self._session.scalar(
            select(MeterFuseBoxAssignment).where(
                MeterFuseBoxAssignment.university_id == scope.university_id,
                MeterFuseBoxAssignment.meter_id == meter_id,
                MeterFuseBoxAssignment.effective_from <= at,
                or_(
                    MeterFuseBoxAssignment.effective_until.is_(None),
                    MeterFuseBoxAssignment.effective_until > at,
                ),
            )
        )
        if assignment is None:
            raise LookupError("meter has no assignment at the requested instant")
        return assignment

    def resolve_fuse_box_apartment(
        self, fuse_box_id: UUID, at: datetime, scope: TenantContext
    ) -> FuseBoxApartmentAssignment:
        assignment = self._session.scalar(
            select(FuseBoxApartmentAssignment).where(
                FuseBoxApartmentAssignment.university_id == scope.university_id,
                FuseBoxApartmentAssignment.fuse_box_id == fuse_box_id,
                FuseBoxApartmentAssignment.effective_from <= at,
                or_(
                    FuseBoxApartmentAssignment.effective_until.is_(None),
                    FuseBoxApartmentAssignment.effective_until > at,
                ),
            )
        )
        if assignment is None:
            raise LookupError("fuse box has no assignment at the requested instant")
        return assignment
