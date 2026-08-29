"""Specification-derived tests for university-local competition windows."""

from datetime import UTC, datetime, timedelta

import pytest

from platform_app.modules.competition.windows import (
    UtcWindow,
    cumulative_comparison_windows,
)


def utc(year: int, month: int, day: int, hour: int) -> datetime:
    """Build an exact UTC hour used as an independently calculated oracle."""
    return datetime(year, month, day, hour, tzinfo=UTC)


def test_thursday_board_compares_matching_monday_to_thursday_periods() -> None:
    windows = cumulative_comparison_windows(
        cutoff=utc(2026, 1, 8, 0),
        timezone_name="Asia/Singapore",
    )

    assert windows.current == UtcWindow(
        start=utc(2026, 1, 5, 0),
        end=utc(2026, 1, 8, 0),
    )
    assert windows.previous == UtcWindow(
        start=utc(2025, 12, 29, 0),
        end=utc(2026, 1, 1, 0),
    )


def test_monday_cutoff_compares_two_complete_consecutive_weeks() -> None:
    windows = cumulative_comparison_windows(
        cutoff=utc(2026, 1, 12, 0),
        timezone_name="Asia/Singapore",
    )

    assert windows.current == UtcWindow(
        start=utc(2026, 1, 5, 0),
        end=utc(2026, 1, 12, 0),
    )
    assert windows.previous == UtcWindow(
        start=utc(2025, 12, 29, 0),
        end=utc(2026, 1, 5, 0),
    )
    assert windows.current.duration == timedelta(days=7)
    assert windows.previous.duration == timedelta(days=7)


def test_window_is_start_inclusive_and_end_exclusive() -> None:
    window = UtcWindow(
        start=utc(2026, 1, 5, 0),
        end=utc(2026, 1, 8, 0),
    )

    assert window.contains(window.start)
    assert window.contains(window.end - timedelta(microseconds=1))
    assert not window.contains(window.end)
    assert not window.contains(window.start - timedelta(microseconds=1))


@pytest.mark.parametrize(
    ("timezone_name", "cutoff", "expected_start", "expected_end"),
    [
        (
            "Asia/Singapore",
            utc(2026, 7, 9, 0),
            utc(2026, 7, 6, 0),
            utc(2026, 7, 9, 0),
        ),
        (
            "America/New_York",
            utc(2026, 7, 9, 12),
            utc(2026, 7, 6, 12),
            utc(2026, 7, 9, 12),
        ),
        (
            "Australia/Lord_Howe",
            datetime(2026, 7, 8, 21, 30, tzinfo=UTC),
            datetime(2026, 7, 5, 21, 30, tzinfo=UTC),
            datetime(2026, 7, 8, 21, 30, tzinfo=UTC),
        ),
    ],
)
def test_local_eight_am_is_converted_for_each_iana_timezone(
    timezone_name: str,
    cutoff: datetime,
    expected_start: datetime,
    expected_end: datetime,
) -> None:
    windows = cumulative_comparison_windows(cutoff, timezone_name)

    assert windows.current.start == expected_start
    assert windows.current.end == expected_end


def test_spring_dst_gap_produces_a_167_hour_local_week() -> None:
    windows = cumulative_comparison_windows(
        cutoff=utc(2026, 3, 9, 12),
        timezone_name="America/New_York",
    )

    assert windows.current == UtcWindow(
        start=utc(2026, 3, 2, 13),
        end=utc(2026, 3, 9, 12),
    )
    assert windows.current.duration == timedelta(hours=167)
    assert windows.previous.duration == timedelta(hours=168)


def test_autumn_dst_fold_produces_a_169_hour_local_week() -> None:
    windows = cumulative_comparison_windows(
        cutoff=utc(2026, 11, 2, 13),
        timezone_name="America/New_York",
    )

    assert windows.current == UtcWindow(
        start=utc(2026, 10, 26, 12),
        end=utc(2026, 11, 2, 13),
    )
    assert windows.current.duration == timedelta(hours=169)
    assert windows.previous.duration == timedelta(hours=168)


def test_year_boundary_keeps_local_calendar_alignment() -> None:
    windows = cumulative_comparison_windows(
        cutoff=utc(2027, 1, 1, 0),
        timezone_name="Asia/Singapore",
    )

    assert windows.current == UtcWindow(
        start=utc(2026, 12, 28, 0),
        end=utc(2027, 1, 1, 0),
    )
    assert windows.previous == UtcWindow(
        start=utc(2026, 12, 21, 0),
        end=utc(2026, 12, 25, 0),
    )


def test_semester_boundary_does_not_clip_a_competition_window() -> None:
    windows = cumulative_comparison_windows(
        cutoff=utc(2026, 8, 20, 0),
        timezone_name="Asia/Singapore",
    )

    assert windows.current == UtcWindow(
        start=utc(2026, 8, 17, 0),
        end=utc(2026, 8, 20, 0),
    )
    assert windows.previous == UtcWindow(
        start=utc(2026, 8, 10, 0),
        end=utc(2026, 8, 13, 0),
    )


@pytest.mark.parametrize(
    "cutoff",
    [
        datetime(2026, 1, 8, 8),
        utc(2026, 1, 8, 1),
        datetime(2026, 1, 8, 0, 1, tzinfo=UTC),
    ],
)
def test_cutoff_must_be_an_aware_exact_local_eight_am(cutoff: datetime) -> None:
    with pytest.raises(ValueError, match="08:00"):
        cumulative_comparison_windows(cutoff, "Asia/Singapore")


def test_window_rejects_non_positive_or_naive_boundaries() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        UtcWindow(
            start=datetime(2026, 1, 5, 0),
            end=utc(2026, 1, 8, 0),
        )

    with pytest.raises(ValueError, match="before"):
        UtcWindow(
            start=utc(2026, 1, 8, 0),
            end=utc(2026, 1, 8, 0),
        )
