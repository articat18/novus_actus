/**
 * Pure university-local competition-window calculations
 * (port of platform_app.modules.competition.windows).
 *
 * Competition boundaries are calendar boundaries in a university's IANA
 * timezone. They are converted to UTC only after local calendar arithmetic, so
 * a week stays a local Monday-to-Monday week across daylight-saving transitions
 * (yielding 167- or 169-hour "weeks" of real elapsed time).
 */
import { DateTime } from "luxon";

/** Local hour at which every competition boundary falls. */
export const COMPETITION_BOUNDARY_HOUR = 8;

const MS_PER_HOUR = 3_600_000;

/** A start-inclusive, end-exclusive UTC interval. */
export class UtcWindow {
  readonly start: Date;
  readonly end: Date;

  constructor(start: Date, end: Date) {
    if (Number.isNaN(start.getTime())) {
      throw new Error("window start must be a valid instant");
    }
    if (Number.isNaN(end.getTime())) {
      throw new Error("window end must be a valid instant");
    }
    if (start.getTime() >= end.getTime()) {
      throw new Error("window start must be before window end");
    }
    this.start = start;
    this.end = end;
  }

  /** Elapsed real time represented by the window, in milliseconds. */
  get durationMs(): number {
    return this.end.getTime() - this.start.getTime();
  }

  /** Elapsed real time in whole hours (windows always align to the hour). */
  get durationHours(): number {
    return this.durationMs / MS_PER_HOUR;
  }

  /** Whether `instant` falls within `[start, end)`. */
  contains(instant: Date): boolean {
    const t = instant.getTime();
    return this.start.getTime() <= t && t < this.end.getTime();
  }

  equals(other: UtcWindow): boolean {
    return (
      this.start.getTime() === other.start.getTime() &&
      this.end.getTime() === other.end.getTime()
    );
  }
}

/** Matching current and immediately preceding cumulative periods. */
export interface ComparisonWindows {
  current: UtcWindow;
  previous: UtcWindow;
}

/**
 * Build matching competition periods ending at a local daily cutoff.
 *
 * `cutoff` must represent exactly 08:00 in `timezoneName`. For Tuesday through
 * Sunday, the current period begins at 08:00 on the Monday of that local week.
 * A Monday cutoff closes the week that has just completed, so its current period
 * begins on the preceding Monday rather than producing an empty interval. The
 * previous period uses the same local elapsed portion one local calendar week
 * earlier.
 */
export function cumulativeComparisonWindows(
  cutoff: Date,
  timezoneName: string,
): ComparisonWindows {
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error("cutoff must be a valid instant");
  }

  const cutoffLocal = DateTime.fromJSDate(cutoff, { zone: timezoneName });
  if (!cutoffLocal.isValid) {
    throw new Error(
      `invalid university timezone: ${cutoffLocal.invalidReason ?? timezoneName}`,
    );
  }

  const isExactBoundary =
    cutoffLocal.hour === COMPETITION_BOUNDARY_HOUR &&
    cutoffLocal.minute === 0 &&
    cutoffLocal.second === 0 &&
    cutoffLocal.millisecond === 0;
  if (!isExactBoundary) {
    throw new Error("cutoff must be exactly 08:00 in the university timezone");
  }

  // luxon weekday: Monday = 1 … Sunday = 7.
  const daysSinceMonday = cutoffLocal.weekday - 1;
  const daysSinceCurrentStart = daysSinceMonday === 0 ? 7 : daysSinceMonday;

  const atBoundary = (dt: DateTime): DateTime =>
    dt.set({
      hour: COMPETITION_BOUNDARY_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

  const currentStart = atBoundary(cutoffLocal.minus({ days: daysSinceCurrentStart }));
  const previousStart = atBoundary(
    cutoffLocal.minus({ days: daysSinceCurrentStart + 7 }),
  );
  const previousEnd = atBoundary(cutoffLocal.minus({ days: 7 }));

  return {
    current: new UtcWindow(toUtcDate(currentStart), cutoff),
    previous: new UtcWindow(toUtcDate(previousStart), toUtcDate(previousEnd)),
  };
}

function toUtcDate(local: DateTime): Date {
  return local.toUTC().toJSDate();
}
