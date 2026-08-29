/**
 * MongoDB collection shapes, typed accessors, and indexes.
 *
 * The data model for the energy leaderboard is deliberately small:
 *
 *   users        one account (email + password sign-in, no OAuth)
 *   households   a group that owns rooms (a family, a flat, an org)
 *   rooms        one room, occupied by exactly ONE user, tracking cumulative
 *                energy use in kilowatt-hours (kWh)
 *
 * The chain is  user 1—1 room  ->  household 1—* rooms. A user's household is
 * reached through their room, so it is never duplicated onto the user.
 *
 * IDs are app-generated UUID strings stored in `_id` (see `schemas.ts`), not the
 * driver's default ObjectId — this keeps identifiers stable and human-readable
 * and matches the rest of the codebase.
 */
import type { Collection, Db, IndexDescription } from "mongodb";

/** Collection names, referenced everywhere instead of raw string literals. */
export const COLLECTIONS = {
  users: "users",
  households: "households",
  rooms: "rooms",
  sessions: "sessions",
} as const;

/** A stored account. `email` is the normalized (lower-cased) canonical form. */
export interface UserDocument {
  _id: string;
  /** Display username as entered (case preserved). */
  username: string;
  /** Lower-cased username, used only for case-insensitive uniqueness. */
  normalizedUsername: string;
  /** Normalized (trimmed, lower-cased) email — the unique login identifier. */
  email: string;
  /** Salted scrypt digest (`scrypt$<salt>$<hash>`); never the plaintext. */
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A group that owns rooms. */
export interface HouseholdDocument {
  _id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A single room, held by one user, with its running energy total in kWh. */
export interface RoomDocument {
  _id: string;
  name: string;
  /** -> households._id */
  householdId: string;
  /** -> users._id. Exactly one user per room; enforced unique. */
  userId: string;
  /** Cumulative energy consumed by this room, in kilowatt-hours. */
  energyKwh: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An issued access session. The `_id` is the HMAC digest of the opaque bearer
 * token (the raw token is never stored), so validating a token is a single `_id`
 * lookup and sign-out is a single delete. A TTL index drops expired rows.
 */
export interface SessionDocument {
  _id: string;
  /** -> users._id */
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export function usersCollection(db: Db): Collection<UserDocument> {
  return db.collection<UserDocument>(COLLECTIONS.users);
}

export function householdsCollection(db: Db): Collection<HouseholdDocument> {
  return db.collection<HouseholdDocument>(COLLECTIONS.households);
}

export function roomsCollection(db: Db): Collection<RoomDocument> {
  return db.collection<RoomDocument>(COLLECTIONS.rooms);
}

export function sessionsCollection(db: Db): Collection<SessionDocument> {
  return db.collection<SessionDocument>(COLLECTIONS.sessions);
}

const USER_INDEXES: IndexDescription[] = [
  { key: { email: 1 }, name: "uq_users_email", unique: true },
  { key: { normalizedUsername: 1 }, name: "uq_users_username", unique: true },
];

const ROOM_INDEXES: IndexDescription[] = [
  // One room per user: a person lives in a single room.
  { key: { userId: 1 }, name: "uq_rooms_user", unique: true },
  // Fast "all rooms in a household" lookups (leaderboard, household view).
  { key: { householdId: 1 }, name: "ix_rooms_household" },
];

const SESSION_INDEXES: IndexDescription[] = [
  // Let MongoDB remove each session as soon as it passes its `expiresAt`.
  { key: { expiresAt: 1 }, name: "ttl_sessions_expires", expireAfterSeconds: 0 },
];

/**
 * Create every collection index. Idempotent — safe to run on each startup.
 * Households need no index beyond the implicit `_id`.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  await usersCollection(db).createIndexes(USER_INDEXES);
  await roomsCollection(db).createIndexes(ROOM_INDEXES);
  await sessionsCollection(db).createIndexes(SESSION_INDEXES);
}
