/**
 * Shared integration-test fixtures: seeding helpers and a fake university
 * gateway / mutable clock (port of the helpers in test_identity_api.py).
 */
import type { PrismaClient } from "@prisma/client";

import type { Config } from "../config.js";
import type {
  UniversityVerification,
  UniversityVerificationGateway,
} from "../modules/university/contracts.js";

export const NOW = new Date("2026-08-29T00:00:00.000Z");
export const CHALLENGE_KEY = "challenge-key-that-is-at-least-32-bytes";
export const SESSION_KEY = "session-key-that-is-at-least-32-bytes-long";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    databaseUrl: "mongodb://unused/db",
    challengeHmacKey: CHALLENGE_KEY,
    sessionHmacKey: SESSION_KEY,
    universityGateway: "roster",
    universityApiUrl: "http://localhost:3001",
    enableDevInbox: false,
    port: 3001,
    serviceName: "Energy Leaderboard Platform",
    ...overrides,
  };
}

export async function addUniversity(
  db: PrismaClient,
  {
    name = "Demo University",
    domain = "demo.edu",
    rosterReference = "demo-university",
  }: { name?: string; domain?: string; rosterReference?: string } = {},
): Promise<{ id: string }> {
  const university = await db.university.create({
    data: {
      name,
      timezone: "Asia/Singapore",
      rosterReference,
      status: "active",
      emailDomains: { create: { normalizedDomain: domain } },
    },
  });
  return { id: university.id };
}

export function activeVerification(
  studentReference: string,
  universityReference = "demo-university",
): UniversityVerification {
  return {
    status: "active",
    universityReference,
    studentReference,
    residence: {
      buildingReference: "hall-1",
      apartmentReference: "hall-1-a01",
      roomReference: "hall-1-a01-r1",
      sourceVersion: "residence-v1",
    },
  };
}

/** In-memory gateway keyed by email (port of FakeUniversityGateway). */
export class FakeUniversityGateway implements UniversityVerificationGateway {
  readonly results = new Map<string, UniversityVerification>();

  set(email: string, verification: UniversityVerification): void {
    this.results.set(email, verification);
  }

  verifyResident(email: string): Promise<UniversityVerification> {
    const result = this.results.get(email);
    if (result === undefined) {
      return Promise.reject(new Error(`no fake verification for ${email}`));
    }
    return Promise.resolve(result);
  }
}

/** Mutable clock so tests can advance time deterministically. */
export class MutableClock {
  constructor(public now: Date = NOW) {}
  readonly fn = (): Date => this.now;
  advanceMinutes(minutes: number): void {
    this.now = new Date(this.now.getTime() + minutes * 60_000);
  }
}

/** Seed the minimal roster scenario used by the verification suite. */
export async function seedDemoRoster(db: PrismaClient): Promise<void> {
  const university = await db.rosterUniversity.create({
    data: {
      externalReference: "demo-university",
      name: "Demo University",
      normalizedEmailDomain: "demo.edu",
      buildings: {
        create: {
          externalReference: "hall-1",
          name: "Hall 1",
          apartments: {
            create: {
              externalReference: "hall-1-a01",
              label: "Apartment A01",
              rooms: {
                create: { externalReference: "hall-1-a01-r1", label: "Room 1" },
              },
            },
          },
        },
      },
    },
    include: {
      buildings: { include: { apartments: { include: { rooms: true } } } },
    },
  });
  const room = university.buildings[0]!.apartments[0]!.rooms[0]!;
  const start = new Date("2026-01-01T00:00:00.000Z");
  const ended = new Date("2026-06-01T00:00:00.000Z");

  const active = await db.student.create({
    data: {
      universityId: university.id,
      externalReference: "student-active",
      normalizedEmail: "active@demo.edu",
    },
  });
  await db.enrollment.create({
    data: {
      studentId: active.id,
      active: true,
      effectiveStart: start,
      sourceVersion: "roster-v1",
    },
  });
  await db.residenceAssignment.create({
    data: {
      studentId: active.id,
      roomId: room.id,
      effectiveStart: start,
      sourceVersion: "residence-v1",
    },
  });

  const inactive = await db.student.create({
    data: {
      universityId: university.id,
      externalReference: "student-inactive",
      normalizedEmail: "inactive@demo.edu",
    },
  });
  await db.enrollment.create({
    data: {
      studentId: inactive.id,
      active: false,
      effectiveStart: start,
      effectiveEnd: ended,
      sourceVersion: "roster-v1",
    },
  });
}
