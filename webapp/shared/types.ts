export type LeaderboardPeriod = "daily" | "monthly" | "yearly";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface LeaderboardEntry {
  householdId: string;
  householdName: string;
  rank: number;
  totalKwh: number;
  totalPax: number;
  kwhPerPax: number;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  periodLabel: string;
  generatedAt: string;
  entries: LeaderboardEntry[];
}

export interface HouseholdOption {
  id: string;
  name: string;
}

export interface RoomLeaderboardEntry {
  roomId: string;
  roomName: string;
  rank: number;
  totalKwh: number;
  pax: number;
  kwhPerPax: number;
}

export interface RoomLeaderboardResponse {
  period: LeaderboardPeriod;
  periodLabel: string;
  generatedAt: string;
  household: HouseholdOption | null;
  households: HouseholdOption[];
  entries: RoomLeaderboardEntry[];
}
