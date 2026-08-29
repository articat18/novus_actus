/**
 * Input validation (zod) and document factories for the persistence layer.
 *
 * Routers/services validate untrusted input with the `*Input` schemas, then hand
 * the parsed value to a `new*Document` factory. The factory owns everything the
 * caller must not choose: the UUID `_id`, the created/updated timestamps, email
 * and username normalization, and password hashing. This keeps those invariants
 * in one place so a document can never be built half-normalized.
 */
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hashPassword } from "../crypto.js";
import type {
  HouseholdDocument,
  RoomDocument,
  UserDocument,
} from "./collections.js";

/** Lower-case + trim a username for case-insensitive uniqueness. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const CreateUserInput = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_.-]+$/, "letters, numbers, and . _ - only"),
    email: z.string().email().max(320),
    password: z.string().min(8).max(200),
  })
  .strict();
export type CreateUserInput = z.infer<typeof CreateUserInput>;

/** Build a full {@link UserDocument}: generates `_id`, normalizes, hashes. */
export function newUserDocument(
  input: CreateUserInput,
  now: Date = new Date(),
): UserDocument {
  return {
    _id: randomUUID(),
    username: input.username.trim(),
    normalizedUsername: normalizeUsername(input.username),
    email: input.email.trim().toLowerCase(),
    passwordHash: hashPassword(input.password),
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

export const CreateHouseholdInput = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();
export type CreateHouseholdInput = z.infer<typeof CreateHouseholdInput>;

export function newHouseholdDocument(
  input: CreateHouseholdInput,
  now: Date = new Date(),
): HouseholdDocument {
  return {
    _id: randomUUID(),
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

export const CreateRoomInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    householdId: z.string().uuid(),
    userId: z.string().uuid(),
    // A room may be created with a starting reading; defaults to no usage yet.
    energyKwh: z.number().nonnegative().finite().default(0),
  })
  .strict();
export type CreateRoomInput = z.infer<typeof CreateRoomInput>;

export function newRoomDocument(
  input: CreateRoomInput,
  now: Date = new Date(),
): RoomDocument {
  return {
    _id: randomUUID(),
    name: input.name.trim(),
    householdId: input.householdId,
    userId: input.userId,
    energyKwh: input.energyKwh,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update a room's cumulative energy. `mode: "set"` replaces the running total
 * (e.g. from a fresh meter reading); `mode: "add"` increments it by a delta.
 */
export const RecordEnergyInput = z
  .object({
    energyKwh: z.number().nonnegative().finite(),
    mode: z.enum(["set", "add"]).default("set"),
  })
  .strict();
export type RecordEnergyInput = z.infer<typeof RecordEnergyInput>;
