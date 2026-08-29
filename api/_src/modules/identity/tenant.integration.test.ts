/**
 * Tenant isolation, deny-by-default authorization on live routes, and the
 * audited cross-tenant read (AD-008, REQ-ADM-001, REQ-TEN-001).
 *
 * These cover the paths that previously had no call site: AuthorizationService
 * enforcement on a real request, IdentityRepository tenant scoping, and the
 * platform override that writes the only audit event in the system.
 * Requires TEST_DATABASE_URL.
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import { createApp } from "../../app.js";
import {
  describeIntegration,
  disconnect,
  ensureSchema,
  resetDatabase,
  testDb,
} from "../../test/db.js";
import {
  activeVerification,
  addAccountWithRole,
  addUniversity,
  FakeUniversityGateway,
  MutableClock,
  testConfig,
} from "../../test/fixtures.js";
import { InMemoryEmailCodeSender } from "./ports.js";
import {
  IdentityRepository,
  ProfileNotFoundError,
  TenantAccessDeniedError,
  tenantContext,
} from "./tenant.js";

interface Harness {
  app: Express;
  gateway: FakeUniversityGateway;
}

function harness(): Harness {
  const gateway = new FakeUniversityGateway();
  const app = createApp({
    config: testConfig(),
    db: testDb(),
    gateway,
    sender: new InMemoryEmailCodeSender(),
    clock: new MutableClock().fn,
    codeFactory: () => "123456",
    tokenFactory: () => "participant-session-token",
    enableDevInbox: false,
  });
  return { app, gateway };
}

/** Activate a participant over HTTP and return their session token. */
async function activate(
  { app, gateway }: Harness,
  email: string,
  username: string,
  studentReference: string,
): Promise<string> {
  gateway.set(email, activeVerification(studentReference));
  const challenge = await request(app)
    .post("/api/v1/auth/challenges")
    .send({ email });
  expect(challenge.status).toBe(202);
  const verified = await request(app)
    .post("/api/v1/auth/challenges/verify")
    .send({
      challengeId: challenge.body.challengeId,
      code: "123456",
      username,
    });
  expect(verified.status).toBe(200);
  return verified.body.accessToken as string;
}

describeIntegration("tenant isolation and authorization", () => {
  beforeAll(() => ensureSchema());
  beforeEach(() => resetDatabase());
  afterAll(() => disconnect());

  it("returns the caller's own profile and no private fields", async () => {
    await addUniversity(testDb());
    const h = harness();
    const token = await activate(h, "active@demo.edu", "kilowatt_kid", "s-1");

    const response = await request(h.app)
      .get("/api/v1/me/profile")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual([
      "createdAt",
      "profileId",
      "username",
    ]);
    expect(response.body.username).toBe("kilowatt_kid");
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("demo.edu");
    expect(serialized).not.toContain("hall-1");
  });

  it("requires a token for the profile read", async () => {
    await addUniversity(testDb());
    const response = await request(harness().app).get("/api/v1/me/profile");
    expect(response.status).toBe(401);
  });

  it("denies a username change once the role grant is revoked", async () => {
    await addUniversity(testDb());
    const h = harness();
    const token = await activate(h, "active@demo.edu", "kilowatt_kid", "s-1");

    // A valid session is not authority on its own: drop the participant grant
    // and the same token must stop being able to act.
    await testDb().roleAssignment.deleteMany({});

    const response = await request(h.app)
      .patch("/api/v1/me/username")
      .set("authorization", `Bearer ${token}`)
      .send({ username: "renamed_user" });

    expect(response.status).toBe(403);
    const profile = await testDb().userProfile.findFirst({});
    expect(profile?.username).toBe("kilowatt_kid");
  });

  it("denies a participant the cross-tenant profile read", async () => {
    const university = await addUniversity(testDb());
    const h = harness();
    const token = await activate(h, "active@demo.edu", "kilowatt_kid", "s-1");

    const response = await request(h.app)
      .get("/api/v1/admin/profiles")
      .query({ universityId: university.id, reason: "curiosity" })
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(await testDb().auditEvent.count()).toBe(0);
  });

  it("requires an explicit tenant and a reason for the cross-tenant read", async () => {
    const university = await addUniversity(testDb());
    const admin = await addAccountWithRole(testDb(), {
      role: "platform_admin",
      token: "platform-token",
    });
    const h = harness();

    const noReason = await request(h.app)
      .get("/api/v1/admin/profiles")
      .query({ universityId: university.id })
      .set("authorization", `Bearer ${admin.token}`);
    expect(noReason.status).toBe(422);

    const blankReason = await request(h.app)
      .get("/api/v1/admin/profiles")
      .query({ universityId: university.id, reason: "   " })
      .set("authorization", `Bearer ${admin.token}`);
    expect(blankReason.status).toBe(422);

    const noTenant = await request(h.app)
      .get("/api/v1/admin/profiles")
      .query({ reason: "incident 42" })
      .set("authorization", `Bearer ${admin.token}`);
    expect(noTenant.status).toBe(422);

    const noToken = await request(h.app)
      .get("/api/v1/admin/profiles")
      .query({ universityId: university.id, reason: "incident 42" });
    expect(noToken.status).toBe(401);

    expect(await testDb().auditEvent.count()).toBe(0);
  });

  it("lets a platform admin read a tenant's profiles and audits the access", async () => {
    const university = await addUniversity(testDb());
    const h = harness();
    await activate(h, "active@demo.edu", "kilowatt_kid", "s-1");
    const admin = await addAccountWithRole(testDb(), {
      role: "platform_admin",
      token: "platform-token",
    });

    const response = await request(h.app)
      .get("/api/v1/admin/profiles")
      .query({ universityId: university.id, reason: "incident 42" })
      .set("authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.universityId).toBe(university.id);
    expect(response.body.profiles).toHaveLength(1);
    expect(response.body.profiles[0].username).toBe("kilowatt_kid");

    const events = await testDb().auditEvent.findMany({});
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("platform.cross_tenant.read");
    expect(events[0]?.reason).toBe("incident 42");
    expect(events[0]?.actorAccountId).toBe(admin.accountId);
    expect(events[0]?.universityId).toBe(university.id);
  });

  it("scopes profile reads to one tenant and hides the rest", async () => {
    const first = await addUniversity(testDb());
    const second = await addUniversity(testDb(), {
      name: "Other University",
      domain: "other.edu",
      rosterReference: "other-university",
    });
    const h = harness();
    await activate(h, "active@demo.edu", "kilowatt_kid", "s-1");
    const profile = await testDb().userProfile.findFirstOrThrow({});
    const repository = new IdentityRepository(testDb());

    await expect(
      repository.getProfile(profile.id, tenantContext(first.id)),
    ).resolves.toMatchObject({ id: profile.id });

    await expect(
      repository.getProfile(profile.id, tenantContext(second.id)),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);

    expect(await repository.listProfiles(tenantContext(second.id))).toEqual([]);

    await expect(
      repository.getProfile(
        "00000000-0000-0000-0000-000000000000",
        tenantContext(first.id),
      ),
    ).rejects.toBeInstanceOf(ProfileNotFoundError);

    // Tenant-scoped reads are ordinary access and must never be audited.
    expect(await testDb().auditEvent.count()).toBe(0);
  });
});
