import { Router, type Response } from "express";
import type { LeaderboardPeriod } from "../../shared/types";
import { connectToDatabase } from "../config/database";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { Household } from "../models/Household";
import { Room } from "../models/Room";
import {
  calculateLeaderboard,
  calculateRoomLeaderboard,
  getPeriodLabel,
  getPeriodRange,
} from "../services/leaderboard";

const router = Router();
const validPeriods = new Set<LeaderboardPeriod>(["daily", "monthly", "yearly"]);

router.get(
  "/rooms",
  requireAuth,
  async (request: AuthenticatedRequest, response: Response) => {
    const period = parsePeriod(request.query.period);
    const requestedHouseholdId = request.query.householdId;

    if (requestedHouseholdId !== undefined && typeof requestedHouseholdId !== "string") {
      response.status(400).json({ message: "Choose a valid household." });
      return;
    }

    await connectToDatabase();
    const memberRooms = await Room.find({ user: request.auth?.userId })
      .select({ _id: 1 })
      .lean();
    const memberRoomIds = memberRooms.map((room) => room._id);
    const householdDocuments = await Household.find({
      rooms: { $in: memberRoomIds },
    })
      .sort({ name: 1 })
      .lean();

    const selectedHousehold = requestedHouseholdId
      ? householdDocuments.find(
          (household) => household._id.toString() === requestedHouseholdId,
        )
      : householdDocuments[0];

    if (requestedHouseholdId && !selectedHousehold) {
      response.status(404).json({ message: "Household not found." });
      return;
    }

    const now = new Date();
    const { start, end } = getPeriodRange(period, now);
    const roomDocuments = selectedHousehold
      ? await Room.find({ _id: { $in: selectedHousehold.rooms } }).lean()
      : [];
    const entries = calculateRoomLeaderboard(
      roomDocuments.map((room, index) => ({
        id: room._id.toString(),
        name: room.name || `Room ${index + 1}`,
        pax: room.pax,
        usage: room.usage.map((reading) => ({
          kwh: reading.kwh,
          recordedAt: new Date(reading.recordedAt),
        })),
      })),
      start,
      end,
    );

    response.json({
      period,
      periodLabel: getPeriodLabel(period, now),
      generatedAt: now.toISOString(),
      household: selectedHousehold
        ? {
            id: selectedHousehold._id.toString(),
            name: selectedHousehold.name,
          }
        : null,
      households: householdDocuments.map((household) => ({
        id: household._id.toString(),
        name: household.name,
      })),
      entries,
    });
  },
);

router.get(
  "/",
  requireAuth,
  async (request: AuthenticatedRequest, response: Response) => {
    const period = parsePeriod(request.query.period);

    await connectToDatabase();
    const householdDocuments = await Household.find().sort({ name: 1 }).lean();
    const roomIds = householdDocuments.flatMap((household) => household.rooms);
    const roomDocuments = await Room.find({ _id: { $in: roomIds } }).lean();
    const now = new Date();
    const { start, end } = getPeriodRange(period, now);

    const entries = calculateLeaderboard(
      householdDocuments.map((household) => ({
        id: household._id.toString(),
        name: household.name,
        roomIds: household.rooms.map((roomId) => roomId.toString()),
      })),
      roomDocuments.map((room) => ({
        id: room._id.toString(),
        pax: room.pax,
        usage: room.usage.map((reading) => ({
          kwh: reading.kwh,
          recordedAt: new Date(reading.recordedAt),
        })),
      })),
      start,
      end,
    );

    response.json({
      period,
      periodLabel: getPeriodLabel(period, now),
      generatedAt: now.toISOString(),
      entries,
    });
  },
);

function parsePeriod(value: unknown): LeaderboardPeriod {
  return typeof value === "string" && validPeriods.has(value as LeaderboardPeriod)
    ? (value as LeaderboardPeriod)
    : "monthly";
}

export default router;
