/**
 * Household energy leaderboard.
 *
 * Households are ranked by energy use PER CAPITA (total kWh across the
 * household's rooms ÷ number of occupants). Because every room holds exactly one
 * user, the occupant count is simply the number of rooms. First place — rank 1 —
 * is the household that uses the LEAST per person.
 *
 * The leaderboard is derived data, so it is computed on demand rather than
 * stored: {@link computeLeaderboard} sums each household's rooms in MongoDB, then
 * the pure {@link rankEntries} turns those totals into a ranked list. Keeping the
 * ranking pure makes it unit-testable without a database.
 */
import type { Db } from "mongodb";

import {
  COLLECTIONS,
  roomsCollection,
} from "./collections.js";

/** Per-household totals, straight out of the aggregation (unranked). */
export interface HouseholdUsage {
  householdId: string;
  name: string;
  totalKwh: number;
  occupantCount: number;
}

/** One ranked row of the leaderboard. */
export interface LeaderboardEntry {
  /** 1-based position; 1 is the lowest per-capita usage. */
  rank: number;
  householdId: string;
  name: string;
  totalKwh: number;
  occupantCount: number;
  perCapitaKwh: number;
}

/** Round to 3 decimal places to avoid binary-float display noise. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Rank households by per-capita energy, ascending (least first). Households with
 * no occupants are dropped (per-capita is undefined). Ties break by name so the
 * order is stable.
 */
export function rankEntries(rows: HouseholdUsage[]): LeaderboardEntry[] {
  return rows
    .filter((row) => row.occupantCount > 0)
    .map((row) => ({
      householdId: row.householdId,
      name: row.name,
      totalKwh: row.totalKwh,
      occupantCount: row.occupantCount,
      perCapitaKwh: row.totalKwh / row.occupantCount,
    }))
    .sort(
      (a, b) =>
        a.perCapitaKwh - b.perCapitaKwh || a.name.localeCompare(b.name),
    )
    .map((row, index) => ({
      rank: index + 1,
      householdId: row.householdId,
      name: row.name,
      totalKwh: round3(row.totalKwh),
      occupantCount: row.occupantCount,
      perCapitaKwh: round3(row.perCapitaKwh),
    }));
}

/**
 * Compute the live leaderboard: sum each household's room energy in MongoDB,
 * then rank. Households with no rooms do not appear.
 */
export async function computeLeaderboard(db: Db): Promise<LeaderboardEntry[]> {
  const rows = await roomsCollection(db)
    .aggregate<HouseholdUsage>([
      {
        $group: {
          _id: "$householdId",
          totalKwh: { $sum: "$energyKwh" },
          occupantCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: COLLECTIONS.households,
          localField: "_id",
          foreignField: "_id",
          as: "household",
        },
      },
      // Drop rooms whose household is missing (orphans).
      { $unwind: "$household" },
      {
        $project: {
          _id: 0,
          householdId: "$_id",
          name: "$household.name",
          totalKwh: 1,
          occupantCount: 1,
        },
      },
    ])
    .toArray();

  return rankEntries(rows);
}
