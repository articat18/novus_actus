/**
 * MongoDB fixtures shared by integration suites (port of
 * tests/integration/conftest.py).
 *
 * Integration tests self-skip unless TEST_DATABASE_URL is set. When it is set,
 * the schema/indexes are pushed once and every collection is cleared before
 * each test.
 */
import { execSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";
import { describe } from "vitest";

const url = process.env.TEST_DATABASE_URL;

export const hasTestDb = typeof url === "string" && url.length > 0;

/** `describe` when a test database is configured, otherwise `describe.skip`. */
export const describeIntegration = hasTestDb ? describe : describe.skip;

let client: PrismaClient | null = null;

export function testDb(): PrismaClient {
  if (client === null) {
    client = new PrismaClient({ datasourceUrl: url });
  }
  return client;
}

<<<<<<< HEAD
// Leaf collections first: referential actions are emulated by Prisma (Mongo has
// no server-side foreign keys), so a Restrict relation still rejects deleting a
// parent whose children haven't been cleared yet.
const MODELS = [
  "accessSession",
  "emailChallenge",
  "verifiedResidence",
  "roleAssignment",
  "userProfile",
  "universityIdentity",
  "auditEvent",
  "userAccount",
  "universityEmailDomain",
=======
// Order is irrelevant because TRUNCATE ... CASCADE clears dependents.
const TABLES = [
  "access_session",
  "verified_residence",
  "role_assignment",
  "user_profile",
  "university_identity",
  "audit_event",
  "user_account",
  "university_email_domain",
>>>>>>> 407e5f4 (base added)
  "university",
  "residenceAssignment",
  "enrollment",
  "student",
  "rosterRoom",
  "rosterApartment",
  "rosterBuilding",
  "rosterUniversity",
] as const;

let schemaReady = false;

/** Ensure the collections/indexes exist in the test database (idempotent). */
export function ensureSchema(): void {
  if (schemaReady) {
    return;
  }
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  schemaReady = true;
}

export async function resetDatabase(): Promise<void> {
  const db = testDb();
  for (const model of MODELS) {
    await (db[model] as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
}

export async function disconnect(): Promise<void> {
  if (client !== null) {
    await client.$disconnect();
    client = null;
  }
}
