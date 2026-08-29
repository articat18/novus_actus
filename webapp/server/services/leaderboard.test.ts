import { describe, expect, it } from "vitest";
import {
  calculateLeaderboard,
  calculateRoomLeaderboard,
  getPeriodRange,
} from "./leaderboard";

describe("leaderboard calculations", () => {
  it("ranks households by total usage per occupant", () => {
    const entries = calculateLeaderboard(
      [
        { id: "house-a", name: "House A", roomIds: ["room-a", "room-b"] },
        { id: "house-b", name: "House B", roomIds: ["room-c"] },
      ],
      [
        {
          id: "room-a",
          pax: 1,
          usage: [{ kwh: 8, recordedAt: new Date("2026-08-15T12:00:00Z") }],
        },
        {
          id: "room-b",
          pax: 3,
          usage: [{ kwh: 12, recordedAt: new Date("2026-08-15T12:00:00Z") }],
        },
        {
          id: "room-c",
          pax: 2,
          usage: [{ kwh: 14, recordedAt: new Date("2026-08-15T12:00:00Z") }],
        },
      ],
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-31T23:59:59Z"),
    );

    expect(entries).toEqual([
      {
        householdId: "house-a",
        householdName: "House A",
        rank: 1,
        totalKwh: 20,
        totalPax: 4,
        kwhPerPax: 5,
      },
      {
        householdId: "house-b",
        householdName: "House B",
        rank: 2,
        totalKwh: 14,
        totalPax: 2,
        kwhPerPax: 7,
      },
    ]);
  });

  it("ranks named rooms by usage per occupant", () => {
    const entries = calculateRoomLeaderboard(
      [
        {
          id: "room-a",
          name: "Fern Room",
          pax: 2,
          usage: [
            { kwh: 12, recordedAt: new Date("2026-08-15T12:00:00Z") },
            { kwh: 99, recordedAt: new Date("2026-07-31T12:00:00Z") },
          ],
        },
        {
          id: "room-b",
          name: "Canopy Room",
          pax: 3,
          usage: [{ kwh: 15, recordedAt: new Date("2026-08-15T12:00:00Z") }],
        },
      ],
      new Date("2026-08-01T00:00:00Z"),
      new Date("2026-08-31T23:59:59Z"),
    );

    expect(entries).toEqual([
      {
        roomId: "room-b",
        roomName: "Canopy Room",
        rank: 1,
        totalKwh: 15,
        pax: 3,
        kwhPerPax: 5,
      },
      {
        roomId: "room-a",
        roomName: "Fern Room",
        rank: 2,
        totalKwh: 12,
        pax: 2,
        kwhPerPax: 6,
      },
    ]);
  });

  it("uses UTC boundaries for daily, monthly, and yearly periods", () => {
    const now = new Date("2026-08-30T08:30:00Z");

    expect(getPeriodRange("daily", now).start.toISOString()).toBe("2026-08-30T00:00:00.000Z");
    expect(getPeriodRange("monthly", now).start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(getPeriodRange("yearly", now).start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
