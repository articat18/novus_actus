import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  RoomLeaderboardEntry,
} from "../../shared/types";

export interface UsageReadingInput {
  kwh: number;
  recordedAt: Date;
}

export interface RoomInput {
  id: string;
  pax: number;
  usage: UsageReadingInput[];
}

export interface NamedRoomInput extends RoomInput {
  name: string;
}

export interface HouseholdInput {
  id: string;
  name: string;
  roomIds: string[];
}

export function getPeriodRange(period: LeaderboardPeriod, now = new Date()) {
  let start: Date;

  if (period === "daily") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else if (period === "monthly") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  } else {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  return { start, end: now };
}

export function getPeriodLabel(period: LeaderboardPeriod, now = new Date()) {
  if (period === "daily") {
    return now.toLocaleDateString("en", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  if (period === "monthly") {
    return now.toLocaleDateString("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return String(now.getUTCFullYear());
}

export function calculateLeaderboard(
  households: HouseholdInput[],
  rooms: RoomInput[],
  start: Date,
  end: Date,
): LeaderboardEntry[] {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));

  const unranked = households.map((household) => {
    const householdRooms = household.roomIds
      .map((roomId) => roomMap.get(roomId))
      .filter((room): room is RoomInput => Boolean(room));

    const totalPax = householdRooms.reduce((total, room) => total + room.pax, 0);
    const totalKwh = householdRooms.reduce(
      (householdTotal, room) =>
        householdTotal +
        room.usage.reduce((roomTotal, reading) => {
          const recordedAt = reading.recordedAt.getTime();
          const withinPeriod = recordedAt >= start.getTime() && recordedAt <= end.getTime();
          return withinPeriod ? roomTotal + reading.kwh : roomTotal;
        }, 0),
      0,
    );

    return {
      householdId: household.id,
      householdName: household.name,
      rank: 0,
      totalKwh: round(totalKwh),
      totalPax,
      kwhPerPax: totalPax > 0 ? round(totalKwh / totalPax) : Number.POSITIVE_INFINITY,
    };
  });

  return unranked
    .filter((entry) => entry.totalPax > 0)
    .sort((left, right) => {
      const usageDifference = left.kwhPerPax - right.kwhPerPax;
      return usageDifference === 0
        ? left.householdName.localeCompare(right.householdName)
        : usageDifference;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function calculateRoomLeaderboard(
  rooms: NamedRoomInput[],
  start: Date,
  end: Date,
): RoomLeaderboardEntry[] {
  return rooms
    .map((room) => {
      const totalKwh = room.usage.reduce((total, reading) => {
        const recordedAt = reading.recordedAt.getTime();
        const withinPeriod = recordedAt >= start.getTime() && recordedAt <= end.getTime();
        return withinPeriod ? total + reading.kwh : total;
      }, 0);

      return {
        roomId: room.id,
        roomName: room.name,
        rank: 0,
        totalKwh: round(totalKwh),
        pax: room.pax,
        kwhPerPax: round(totalKwh / room.pax),
      };
    })
    .sort((left, right) => {
      const usageDifference = left.kwhPerPax - right.kwhPerPax;
      return usageDifference === 0
        ? left.roomName.localeCompare(right.roomName)
        : usageDifference;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
