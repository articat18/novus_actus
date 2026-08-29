/**
 * Ranking rules for the household leaderboard (pure, no database).
 */
import { describe, expect, it } from "vitest";

import { rankEntries, type HouseholdUsage } from "./leaderboard.js";

const usage = (
  householdId: string,
  name: string,
  totalKwh: number,
  occupantCount: number,
): HouseholdUsage => ({ householdId, name, totalKwh, occupantCount });

describe("rankEntries", () => {
  it("ranks by per-capita usage, least first", () => {
    const ranked = rankEntries([
      usage("h1", "Alpha", 100, 2), // 50 per capita
      usage("h2", "Bravo", 90, 3), //  30 per capita
      usage("h3", "Charlie", 40, 1), // 40 per capita
    ]);

    expect(ranked.map((e) => e.householdId)).toEqual(["h2", "h3", "h1"]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(ranked[0]?.perCapitaKwh).toBe(30);
  });

  it("uses per-capita, not raw total (a bigger household can still win)", () => {
    const ranked = rankEntries([
      usage("big", "Big", 120, 6), // 20 per capita
      usage("small", "Small", 30, 1), // 30 per capita
    ]);

    expect(ranked[0]?.householdId).toBe("big");
  });

  it("breaks per-capita ties by name for a stable order", () => {
    const ranked = rankEntries([
      usage("z", "Zeta", 50, 5), // 10 per capita
      usage("a", "Alpha", 10, 1), // 10 per capita
    ]);

    expect(ranked.map((e) => e.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("drops households with no occupants (per-capita undefined)", () => {
    const ranked = rankEntries([
      usage("empty", "Empty", 0, 0),
      usage("h1", "Alpha", 10, 2),
    ]);

    expect(ranked.map((e) => e.householdId)).toEqual(["h1"]);
  });

  it("rounds totals and per-capita to 3 decimals", () => {
    const ranked = rankEntries([usage("h1", "Alpha", 10, 3)]);

    expect(ranked[0]?.perCapitaKwh).toBe(3.333);
    expect(ranked[0]?.totalKwh).toBe(10);
  });

  it("returns an empty list for no households", () => {
    expect(rankEntries([])).toEqual([]);
  });
});
