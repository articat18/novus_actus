"""Pure university-local competition-window calculations.

Competition boundaries are calendar boundaries in a university's IANA timezone.
They are converted to UTC only after local calendar arithmetic so a week remains a
local Monday-to-Monday week when a daylight-saving transition occurs.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

COMPETITION_BOUNDARY = time(hour=8)
ONE_WEEK = timedelta(days=7)


def _as_aware_utc(value: datetime, *, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")
    return value.astimezone(UTC)


@dataclass(frozen=True, slots=True)
class UtcWindow:
    """A start-inclusive, end-exclusive UTC interval."""

    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        start = _as_aware_utc(self.start, field_name="window start")
        end = _as_aware_utc(self.end, field_name="window end")
        if start >= end:
            raise ValueError("window start must be before window end")
        object.__setattr__(self, "start", start)
        object.__setattr__(self, "end", end)

    @property
    def duration(self) -> timedelta:
        """Return the elapsed real time represented by the local window."""
        return self.end - self.start

    def contains(self, instant: datetime) -> bool:
        """Return whether ``instant`` falls within ``[start, end)``."""
        candidate = _as_aware_utc(instant, field_name="instant")
        return self.start <= candidate < self.end


@dataclass(frozen=True, slots=True)
class ComparisonWindows:
    """Matching current and immediately preceding cumulative periods."""

    current: UtcWindow
    previous: UtcWindow


def _local_boundary(boundary_date: date, timezone: ZoneInfo) -> datetime:
    return datetime.combine(boundary_date, COMPETITION_BOUNDARY, tzinfo=timezone)


def cumulative_comparison_windows(
    cutoff: datetime,
    timezone_name: str,
) -> ComparisonWindows:
    """Build matching competition periods ending at a local daily cutoff.

    ``cutoff`` must represent exactly 08:00 in ``timezone_name``. For Tuesday
    through Sunday, the current period begins at 08:00 on the Monday of that
    local week. A Monday cutoff closes the week that has just completed, so its
    current period begins on the preceding Monday rather than producing an empty
    interval. The previous period uses the same local elapsed portion one local
    calendar week earlier.
    """
    cutoff_utc = _as_aware_utc(cutoff, field_name="cutoff at local 08:00")
    timezone = ZoneInfo(timezone_name)
    cutoff_local = cutoff_utc.astimezone(timezone)
    if cutoff_local.timetz().replace(tzinfo=None) != COMPETITION_BOUNDARY:
        raise ValueError("cutoff must be exactly 08:00 in the university timezone")

    days_since_monday = cutoff_local.weekday()
    days_since_current_start = 7 if days_since_monday == 0 else days_since_monday

    current_start_date = cutoff_local.date() - timedelta(days=days_since_current_start)
    previous_start_date = current_start_date - ONE_WEEK
    previous_end_date = cutoff_local.date() - ONE_WEEK

    current_start = _local_boundary(current_start_date, timezone).astimezone(UTC)
    previous_start = _local_boundary(previous_start_date, timezone).astimezone(UTC)
    previous_end = _local_boundary(previous_end_date, timezone).astimezone(UTC)

    return ComparisonWindows(
        current=UtcWindow(start=current_start, end=cutoff_utc),
        previous=UtcWindow(start=previous_start, end=previous_end),
    )
