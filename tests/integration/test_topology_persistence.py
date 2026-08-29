"""REQ-TOP-001 topology and effective-assignment outcomes."""

from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from platform_app.modules.identity.models import University, UniversityStatus
from platform_app.modules.identity.tenant import TenantAccessDeniedError, TenantContext
from platform_app.modules.topology.models import (
    Apartment,
    Building,
    FuseBox,
    FuseBoxApartmentAssignment,
    Meter,
    MeterFuseBoxAssignment,
    OperationalState,
    Room,
)
from platform_app.modules.topology.repository import TopologyRepository

pytestmark = pytest.mark.integration


def university(session: Session, name: str) -> University:
    item = University(
        name=name, timezone="Asia/Singapore", status=UniversityStatus.ACTIVE
    )
    session.add(item)
    session.flush()
    return item


def topology(session: Session, owner: University) -> tuple[Apartment, FuseBox, Meter]:
    building = Building(university_id=owner.id, name="Hall 1")
    session.add(building)
    session.flush()
    apartment = Apartment(university_id=owner.id, building_id=building.id, label="A-01")
    session.add(apartment)
    session.flush()
    session.add_all(
        [
            Room(university_id=owner.id, apartment_id=apartment.id, label="R1"),
            Room(university_id=owner.id, apartment_id=apartment.id, label="R2"),
        ]
    )
    fuse_box = FuseBox(
        university_id=owner.id,
        external_reference="fuse-main",
        state=OperationalState.ACTIVE,
    )
    second_fuse = FuseBox(
        university_id=owner.id,
        external_reference="fuse-aircon",
        state=OperationalState.ACTIVE,
    )
    meter = Meter(
        university_id=owner.id,
        external_reference="meter-1",
        state=OperationalState.ACTIVE,
    )
    session.add_all([fuse_box, second_fuse, meter])
    session.flush()
    return apartment, fuse_box, meter


def test_apartment_supports_multiple_rooms_and_fuse_boxes(db_session: Session) -> None:
    owner = university(db_session, "University A")
    apartment, fuse_box, _ = topology(db_session, owner)
    second_fuse = FuseBox(
        university_id=owner.id,
        external_reference="fuse-kitchen",
        state=OperationalState.ACTIVE,
    )
    db_session.add(second_fuse)
    db_session.flush()
    start = datetime(2026, 1, 1, tzinfo=UTC)
    db_session.add_all(
        [
            FuseBoxApartmentAssignment(
                university_id=owner.id,
                fuse_box_id=fuse_box.id,
                apartment_id=apartment.id,
                effective_from=start,
            ),
            FuseBoxApartmentAssignment(
                university_id=owner.id,
                fuse_box_id=second_fuse.id,
                apartment_id=apartment.id,
                effective_from=start,
            ),
        ]
    )
    db_session.flush()


def test_overlapping_meter_assignment_is_rejected_but_boundary_replacement_works(
    db_session: Session,
) -> None:
    owner = university(db_session, "University A")
    _, fuse_box, meter = topology(db_session, owner)
    start = datetime(2026, 1, 1, tzinfo=UTC)
    boundary = datetime(2026, 2, 1, tzinfo=UTC)
    db_session.add(
        MeterFuseBoxAssignment(
            university_id=owner.id,
            meter_id=meter.id,
            fuse_box_id=fuse_box.id,
            effective_from=start,
            effective_until=boundary,
        )
    )
    db_session.flush()
    db_session.add(
        MeterFuseBoxAssignment(
            university_id=owner.id,
            meter_id=meter.id,
            fuse_box_id=fuse_box.id,
            effective_from=boundary,
        )
    )
    db_session.flush()

    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.add(
            MeterFuseBoxAssignment(
                university_id=owner.id,
                meter_id=meter.id,
                fuse_box_id=fuse_box.id,
                effective_from=datetime(2026, 1, 15, tzinfo=UTC),
                effective_until=datetime(2026, 1, 20, tzinfo=UTC),
            )
        )
        db_session.flush()


def test_historical_resolution_and_tenant_isolation(db_session: Session) -> None:
    owner = university(db_session, "University A")
    outsider = university(db_session, "University B")
    _, fuse_box, meter = topology(db_session, owner)
    second_fuse = FuseBox(
        university_id=owner.id,
        external_reference="replacement-target",
        state=OperationalState.ACTIVE,
    )
    db_session.add(second_fuse)
    db_session.flush()
    boundary = datetime(2026, 2, 1, tzinfo=UTC)
    db_session.add_all(
        [
            MeterFuseBoxAssignment(
                university_id=owner.id,
                meter_id=meter.id,
                fuse_box_id=fuse_box.id,
                effective_from=datetime(2026, 1, 1, tzinfo=UTC),
                effective_until=boundary,
            ),
            MeterFuseBoxAssignment(
                university_id=owner.id,
                meter_id=meter.id,
                fuse_box_id=second_fuse.id,
                effective_from=boundary,
            ),
        ]
    )
    db_session.flush()
    repository = TopologyRepository(db_session)

    old = repository.resolve_meter_fuse_box(
        meter.id, datetime(2026, 1, 15, tzinfo=UTC), TenantContext(owner.id)
    )
    new = repository.resolve_meter_fuse_box(meter.id, boundary, TenantContext(owner.id))
    assert old.fuse_box_id == fuse_box.id
    assert new.fuse_box_id == second_fuse.id
    with pytest.raises(TenantAccessDeniedError):
        repository.get_meter(meter.id, TenantContext(outsider.id))


def test_database_rejects_cross_tenant_assignment(db_session: Session) -> None:
    owner = university(db_session, "University A")
    outsider = university(db_session, "University B")
    _, fuse_box, meter = topology(db_session, owner)
    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.add(
            MeterFuseBoxAssignment(
                university_id=outsider.id,
                meter_id=meter.id,
                fuse_box_id=fuse_box.id,
                effective_from=datetime(2026, 1, 1, tzinfo=UTC),
            )
        )
        db_session.flush()
