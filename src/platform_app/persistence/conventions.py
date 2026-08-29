"""Shared persistence conventions for identifiers, time, and decimals."""

from datetime import UTC, datetime
from decimal import ROUND_HALF_EVEN, Decimal
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Numeric
from sqlalchemy.sql.type_api import TypeEngine

ENERGY_SCALE = Decimal("0.000001")


def new_id() -> UUID:
    """Return an application-generated opaque identifier."""
    return uuid4()


def utc_now() -> datetime:
    """Return a timezone-aware UTC instant."""
    return datetime.now(UTC)


def utc_datetime_type() -> TypeEngine[datetime]:
    """Build the canonical timezone-aware timestamp type."""
    return DateTime(timezone=True)


def energy_decimal_type() -> TypeEngine[Decimal]:
    """Build the canonical fixed-precision energy type."""
    return Numeric(18, 6, asdecimal=True)


def quantize_energy(value: Decimal) -> Decimal:
    """Normalize energy without introducing binary floating-point values."""
    return value.quantize(ENERGY_SCALE, rounding=ROUND_HALF_EVEN)
