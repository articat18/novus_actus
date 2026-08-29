/**
 * REQ-UNI-001 isolated verification API and consumer contract
 * (port of tests/integration/test_pseudo_university.py). Requires TEST_DATABASE_URL.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import {
  describeIntegration,
  disconnect,
  ensureSchema,
  resetDatabase,
  testDb,
} from "../../test/db.js";
import { seedDemoRoster, testConfig } from "../../test/fixtures.js";
import { HttpUniversityGateway } from "./http-gateway.js";

const VERIFICATION_TIME = new Date("2026-08-29T00:00:00.000Z").toISOString();

describeIntegration("verification api", () => {
  beforeAll(() => ensureSchema());
  beforeEach(async () => {
    await resetDatabase();
    await seedDemoRoster(testDb());
  });
  afterAll(() => disconnect());

  const agent = () => request(createApp({ config: testConfig(), db: testDb() }));

  it.each([
    ["ACTIVE@DEMO.EDU", "active"],
    ["inactive@demo.edu", "inactive"],
    ["unknown@demo.edu", "not_found"],
  ])("verifies %s as %s", async (email, expectedStatus) => {
    const response = await agent()
      .get("/api/v1/verification/residents")
      .query({ email, at: VERIFICATION_TIME });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(expectedStatus);
    if (expectedStatus === "active") {
      expect(response.body.residence).toEqual({
        buildingReference: "hall-1",
        apartmentReference: "hall-1-a01",
        roomReference: "hall-1-a01-r1",
        sourceVersion: "residence-v1",
      });
    } else {
      expect(response.body.residence).toBeNull();
    }
  });

  it("is read-only (405 on non-GET)", async () => {
    const response = await agent()
      .post("/api/v1/verification/residents")
      .query({ email: "active@demo.edu", at: VERIFICATION_TIME });
    expect(response.status).toBe(405);
  });
});

// The HTTP gateway is pure (no database); verify it parses a service payload.
it("HttpUniversityGateway parses an active verification payload", async () => {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        status: "active",
        universityReference: "demo-university",
        studentReference: "student-active",
        residence: {
          buildingReference: "hall-1",
          apartmentReference: "hall-1-a01",
          roomReference: "hall-1-a01-r1",
          sourceVersion: "residence-v1",
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  try {
    const gateway = new HttpUniversityGateway("https://university.test");
    const result = await gateway.verifyResident(
      "active@demo.edu",
      new Date(VERIFICATION_TIME),
    );
    expect(result.status).toBe("active");
    expect(result.residence?.apartmentReference).toBe("hall-1-a01");
  } finally {
    vi.unstubAllGlobals();
  }
});
