/**
 * Specification-derived tests for university-local competition windows
 * (port of tests/competition/test_windows.py).
 */
import { describe, expect, it } from "vitest";

import { UtcWindow, cumulativeComparisonWindows } from "./windows.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Build an exact UTC hour used as an independently calculated oracle. */
function utc(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

describe("cumulativeComparisonWindows", () => {
  it("compares matching Monday→Thursday periods for a Thursday board", () => {
    const windows = cumulativeComparisonWindows(utc(2026, 1, 8, 0), "Asia/Singapore");
    expect(windows.current.equals(new UtcWindow(utc(2026, 1, 5, 0), utc(2026, 1, 8, 0)))).toBe(true);
    expect(windows.previous.equals(new UtcWindow(utc(2025, 12, 29, 0), utc(2026, 1, 1, 0)))).toBe(true);
  });

  it("compares two complete consecutive weeks for a Monday cutoff", () => {
    const windows = cumulativeComparisonWindows(utc(2026, 1, 12, 0), "Asia/Singapore");
    expect(windows.current.equals(new UtcWindow(utc(2026, 1, 5, 0), utc(2026, 1, 12, 0)))).toBe(true);
    expect(windows.previous.equals(new UtcWindow(utc(2025, 12, 29, 0), utc(2026, 1, 5, 0)))).toBe(true);
    expect(windows.current.durationMs).toBe(7 * DAY_MS);
    expect(windows.previous.durationMs).toBe(7 * DAY_MS);
  });

  it("is start-inclusive and end-exclusive", () => {
    const window = new UtcWindow(utc(2026, 1, 5, 0), utc(2026, 1, 8, 0));
    expect(window.contains(window.start)).toBe(true);
    expect(window.contains(new Date(window.end.getTime() - 1))).toBe(true);
    expect(window.contains(window.end)).toBe(false);
    expect(window.contains(new Date(window.start.getTime() - 1))).toBe(false);
  });

  it.each([
    ["Asia/Singapore", utc(2026, 7, 9, 0), utc(2026, 7, 6, 0), utc(2026, 7, 9, 0)],
    ["America/New_York", utc(2026, 7, 9, 12), utc(2026, 7, 6, 12), utc(2026, 7, 9, 12)],
    ["Australia/Lord_Howe", utc(2026, 7, 8, 21, 30), utc(2026, 7, 5, 21, 30), utc(2026, 7, 8, 21, 30)],
  ])("converts local 08:00 for %s", (tz, cutoff, expectedStart, expectedEnd) => {
    const windows = cumulativeComparisonWindows(cutoff as Date, tz as string);
    expect(windows.current.start.getTime()).toBe((expectedStart as Date).getTime());
    expect(windows.current.end.getTime()).toBe((expectedEnd as Date).getTime());
  });

  it("produces a 167-hour local week across the spring DST gap", () => {
    const windows = cumulativeComparisonWindows(utc(2026, 3, 9, 12), "America/New_York");
    expect(windows.current.equals(new UtcWindow(utc(2026, 3, 2, 13), utc(2026, 3, 9, 12)))).toBe(true);
    expect(windows.current.durationHours).toBe(167);
    expect(windows.previous.durationHours).toBe(168);
  });

  it("produces a 169-hour local week across the autumn DST fold", () => {
    const windows = cumulativeComparisonWindows(utc(2026, 11, 2, 13), "America/New_York");
    expect(windows.current.equals(new UtcWindow(utc(2026, 10, 26, 12), utc(2026, 11, 2, 13)))).toBe(true);
    expect(windows.current.durationHours).toBe(169);
    expect(windows.previous.durationHours).toBe(168);
  });

  it("keeps local calendar alignment across a year boundary", () => {
    const windows = cumulativeComparisonWindows(utc(2027, 1, 1, 0), "Asia/Singapore");
    expect(windows.current.equals(new UtcWindow(utc(2026, 12, 28, 0), utc(2027, 1, 1, 0)))).toBe(true);
    expect(windows.previous.equals(new UtcWindow(utc(2026, 12, 21, 0), utc(2026, 12, 25, 0)))).toBe(true);
  });

  it("does not clip a competition window at a semester boundary", () => {
    const windows = cumulativeComparisonWindows(utc(2026, 8, 20, 0), "Asia/Singapore");
    expect(windows.current.equals(new UtcWindow(utc(2026, 8, 17, 0), utc(2026, 8, 20, 0)))).toBe(true);
    expect(windows.previous.equals(new UtcWindow(utc(2026, 8, 10, 0), utc(2026, 8, 13, 0)))).toBe(true);
  });

  it.each([utc(2026, 1, 8, 1), utc(2026, 1, 8, 0, 1)])(
    "rejects a cutoff that is not exactly local 08:00",
    (cutoff) => {
      expect(() => cumulativeComparisonWindows(cutoff, "Asia/Singapore")).toThrow(/08:00/);
    },
  );
});

describe("UtcWindow", () => {
  it("rejects a non-positive interval", () => {
    expect(() => new UtcWindow(utc(2026, 1, 8, 0), utc(2026, 1, 8, 0))).toThrow(/before/);
  });
});
