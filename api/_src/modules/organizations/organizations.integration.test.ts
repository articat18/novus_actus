/**
 * Organization and membership lifecycle over HTTP: scoping, escalation guards,
 * the last-owner invariant, and email visibility. Requires TEST_DATABASE_URL.
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
  FakeUniversityGateway,
  MutableClock,
  testConfig,
} from "../../test/fixtures.js";
import { InMemoryEmailCodeSender } from "../identity/ports.js";

const PASSWORD = "a-sufficiently-long-passphrase";

function makeApp(): Express {
  return createApp({
    config: testConfig(),
    db: testDb(),
    gateway: new FakeUniversityGateway(),
    sender: new InMemoryEmailCodeSender(),
    clock: new MutableClock().fn,
    enableDevInbox: false,
  });
}

interface Actor {
  token: string;
  accountId: string;
  email: string;
}

async function signUp(app: Express, email: string, name: string): Promise<Actor> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: PASSWORD, displayName: name });
  expect(response.status).toBe(201);
  return {
    token: response.body.accessToken as string,
    accountId: response.body.account.accountId as string,
    email,
  };
}

async function createFamily(app: Express, owner: Actor, name = "The Tan Family") {
  const response = await request(app)
    .post("/api/v1/organizations")
    .set("authorization", `Bearer ${owner.token}`)
    .send({ kind: "family", name });
  expect(response.status).toBe(201);
  return response.body;
}

function addMember(
  app: Express,
  actor: Actor,
  organizationId: string,
  email: string,
  role: string,
) {
  return request(app)
    .post(`/api/v1/organizations/${organizationId}/members`)
    .set("authorization", `Bearer ${actor.token}`)
    .send({ email, role });
}

describeIntegration("organizations", () => {
  beforeAll(() => ensureSchema());
  beforeEach(() => resetDatabase());
  afterAll(() => disconnect());

  it("makes the creator the sole owner", async () => {
    const app = makeApp();
    const owner = await signUp(app, "parent@family.test", "Sam");

    const family = await createFamily(app, owner);

    expect(family).toMatchObject({
      kind: "family",
      name: "The Tan Family",
      slug: "the-tan-family",
      role: "owner",
      memberCount: 1,
    });
    const membership = await testDb().organizationMembership.findFirstOrThrow({});
    expect(membership.role).toBe("owner");
    expect(membership.accountId).toBe(owner.accountId);
  });

  it("requires a session for every route", async () => {
    const app = makeApp();
    const owner = await signUp(app, "parent@family.test", "Sam");
    const family = await createFamily(app, owner);

    expect((await request(app).get("/api/v1/organizations")).status).toBe(401);
    expect((await request(app).post("/api/v1/organizations").send({ kind: "family", name: "X" })).status).toBe(401);
    expect((await request(app).get(`/api/v1/organizations/${family.organizationId}`)).status).toBe(401);
  });

  it("lists only the organizations the caller belongs to", async () => {
    const app = makeApp();
    const sam = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");
    await createFamily(app, sam, "Tan Family");
    await createFamily(app, kim, "Lim Family");

    const mine = await request(app)
      .get("/api/v1/organizations")
      .set("authorization", `Bearer ${sam.token}`);

    expect(mine.status).toBe(200);
    expect(mine.body.organizations).toHaveLength(1);
    expect(mine.body.organizations[0].name).toBe("Tan Family");
  });

  it("hides an organization from non-members", async () => {
    const app = makeApp();
    const sam = await signUp(app, "sam@family.test", "Sam");
    const stranger = await signUp(app, "stranger@elsewhere.test", "Stranger");
    const family = await createFamily(app, sam);

    const response = await request(app)
      .get(`/api/v1/organizations/${family.organizationId}`)
      .set("authorization", `Bearer ${stranger.token}`);

    expect(response.status).toBe(403);
  });

  it("gives distinct slugs to organizations sharing a name", async () => {
    const app = makeApp();
    const sam = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");

    const first = await createFamily(app, sam, "Smith Family");
    const second = await createFamily(app, kim, "Smith Family");

    expect(first.slug).toBe("smith-family");
    expect(second.slug).toBe("smith-family-2");
  });

  it("lets a manager add members and refuses unknown or duplicate accounts", async () => {
    const app = makeApp();
    const owner = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");
    const family = await createFamily(app, owner);

    const added = await addMember(app, owner, family.organizationId, kim.email, "member");
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ displayName: "Kim", role: "member" });

    const again = await addMember(app, owner, family.organizationId, kim.email, "member");
    expect(again.status).toBe(409);

    const unknown = await addMember(app, owner, family.organizationId, "nobody@nowhere.test", "member");
    expect(unknown.status).toBe(404);
  });

  it("stops a plain member from managing anyone", async () => {
    const app = makeApp();
    const owner = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");
    const alex = await signUp(app, "alex@family.test", "Alex");
    const family = await createFamily(app, owner);
    await addMember(app, owner, family.organizationId, kim.email, "member");

    const attempt = await addMember(app, kim, family.organizationId, alex.email, "member");
    expect(attempt.status).toBe(403);

    const removal = await request(app)
      .delete(`/api/v1/organizations/${family.organizationId}/members/${owner.accountId}`)
      .set("authorization", `Bearer ${kim.token}`);
    expect(removal.status).toBe(403);
  });

  it("prevents an admin from creating or touching an owner", async () => {
    const app = makeApp();
    const owner = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");
    const alex = await signUp(app, "alex@family.test", "Alex");
    const family = await createFamily(app, owner);
    await addMember(app, owner, family.organizationId, kim.email, "admin");

    // An admin cannot mint a second owner...
    const promote = await addMember(app, kim, family.organizationId, alex.email, "owner");
    expect(promote.status).toBe(403);

    // ...nor escalate themselves...
    const selfPromote = await request(app)
      .patch(`/api/v1/organizations/${family.organizationId}/members/${kim.accountId}`)
      .set("authorization", `Bearer ${kim.token}`)
      .send({ role: "owner" });
    expect(selfPromote.status).toBe(403);

    // ...nor remove the owner.
    const removeOwner = await request(app)
      .delete(`/api/v1/organizations/${family.organizationId}/members/${owner.accountId}`)
      .set("authorization", `Bearer ${kim.token}`);
    expect(removeOwner.status).toBe(403);
  });

  it("keeps at least one owner", async () => {
    const app = makeApp();
    const owner = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");
    const family = await createFamily(app, owner);
    await addMember(app, owner, family.organizationId, kim.email, "admin");

    const demote = await request(app)
      .patch(`/api/v1/organizations/${family.organizationId}/members/${owner.accountId}`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ role: "member" });
    expect(demote.status).toBe(409);

    const leave = await request(app)
      .delete(`/api/v1/organizations/${family.organizationId}/members/${owner.accountId}`)
      .set("authorization", `Bearer ${owner.token}`);
    expect(leave.status).toBe(409);

    // With a second owner in place, the first may step down.
    const promote = await request(app)
      .patch(`/api/v1/organizations/${family.organizationId}/members/${kim.accountId}`)
      .set("authorization", `Bearer ${owner.token}`)
      .send({ role: "owner" });
    expect(promote.status).toBe(200);

    const nowAllowed = await request(app)
      .delete(`/api/v1/organizations/${family.organizationId}/members/${owner.accountId}`)
      .set("authorization", `Bearer ${owner.token}`);
    expect(nowAllowed.status).toBe(204);
  });

  it("lets a member leave on their own", async () => {
    const app = makeApp();
    const owner = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");
    const family = await createFamily(app, owner);
    await addMember(app, owner, family.organizationId, kim.email, "member");

    const left = await request(app)
      .delete(`/api/v1/organizations/${family.organizationId}/members/${kim.accountId}`)
      .set("authorization", `Bearer ${kim.token}`);

    expect(left.status).toBe(204);
    expect(await testDb().organizationMembership.count()).toBe(1);
  });

  it("shows member emails only to managers", async () => {
    const app = makeApp();
    const owner = await signUp(app, "sam@family.test", "Sam");
    const kim = await signUp(app, "kim@family.test", "Kim");
    const family = await createFamily(app, owner);
    await addMember(app, owner, family.organizationId, kim.email, "member");

    const asOwner = await request(app)
      .get(`/api/v1/organizations/${family.organizationId}`)
      .set("authorization", `Bearer ${owner.token}`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.members).toHaveLength(2);
    expect(asOwner.body.members.every((m: { email?: string }) => typeof m.email === "string")).toBe(true);

    const asMember = await request(app)
      .get(`/api/v1/organizations/${family.organizationId}`)
      .set("authorization", `Bearer ${kim.token}`);
    expect(asMember.status).toBe(200);
    expect(asMember.body.role).toBe("member");
    expect(asMember.body.members.every((m: { email?: string }) => m.email === undefined)).toBe(true);
    expect(JSON.stringify(asMember.body)).not.toContain("sam@family.test");
    // Display names stay visible so a roster is still readable.
    expect(asMember.body.members.map((m: { displayName: string }) => m.displayName).sort()).toEqual(["Kim", "Sam"]);
  });

  it("treats an unknown organization id as not found", async () => {
    const app = makeApp();
    const owner = await signUp(app, "sam@family.test", "Sam");

    const badShape = await request(app)
      .get("/api/v1/organizations/not-a-uuid")
      .set("authorization", `Bearer ${owner.token}`);
    expect(badShape.status).toBe(404);

    const absent = await request(app)
      .get("/api/v1/organizations/00000000-0000-0000-0000-000000000000")
      .set("authorization", `Bearer ${owner.token}`);
    expect(absent.status).toBe(403);
  });
});
