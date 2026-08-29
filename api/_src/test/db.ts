/**
 * PostgreSQL fixtures shared by integration suites (port of
 * tests/integration/conftest.py).
 *
 * Integration tests self-skip unless TEST_DATABASE_URL is set. When it is set,
 * the schema is pushed once and every table is truncated before each test.
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

// Order is irrelevant because TRUNCATE ... CASCADE clears dependents.
const TABLES = [
  "access_session",
  "organization_membership",
  "organization",
  "user_credential",
  "email_challenge",
  "verified_residence",
  "role_assignment",
  "user_profile",
  "university_identity",
  "audit_event",
  "user_account",
  "university_email_domain",
  "university",
  "residence_assignment",
  "enrollment",
  "student",
  "roster_room",
  "roster_apartment",
  "roster_building",
  "roster_university",
];

let schemaReady = false;

/** Ensure the schema exists in the test database (idempotent). */
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
  const list = TABLES.map((table) => `"${table}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}

export async function disconnect(): Promise<void> {
  if (client !== null) {
    await client.$disconnect();
    client = null;
  }
}
