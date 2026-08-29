/**
 * Email + password registration, sign-in, and session behaviour over HTTP.
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
  addUniversity,
  FakeUniversityGateway,
  MutableClock,
  testConfig,
} from "../../test/fixtures.js";
import { InMemoryEmailCodeSender } from "../identity/ports.js";

const PASSWORD = "a-sufficiently-long-passphrase";

function makeApp(gateway = new FakeUniversityGateway()): {
  app: Express;
  gateway: FakeUniversityGateway;
} {
  const app = createApp({
    config: testConfig(),
    db: testDb(),
    gateway,
    sender: new InMemoryEmailCodeSender(),
    clock: new MutableClock().fn,
    codeFactory: () => "123456",
    enableDevInbox: false,
  });
  return { app, gateway };
}

describeIntegration("account authentication", () => {
  beforeAll(() => ensureSchema());
  beforeEach(() => resetDatabase());
  afterAll(() => disconnect());

  it("registers an account and opens a session without echoing the password", async () => {
    const { app } = makeApp();

    const response = await request(app).post("/api/v1/auth/register").send({
      email: "  Parent@Family.Test ",
      password: PASSWORD,
      displayName: "  Sam   Tan  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.tokenType).toBe("bearer");
    expect(response.body.account).toEqual({
      accountId: expect.any(String),
      email: "parent@family.test",
      displayName: "Sam Tan",
    });
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);

    const credential = await testDb().userCredential.findFirstOrThrow({});
    expect(credential.passwordHash).not.toContain(PASSWORD);
    expect(credential.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(await testDb().userAccount.count()).toBe(1);
    expect(await testDb().accessSession.count()).toBe(1);
  });

  it("refuses an address that is already registered, ignoring case and spacing", async () => {
    const { app } = makeApp();
    const first = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "parent@family.test", password: PASSWORD, displayName: "Sam" });
    expect(first.status).toBe(201);

    const again = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: " PARENT@Family.Test ", password: PASSWORD, displayName: "Imposter" });

    expect(again.status).toBe(409);
    expect(await testDb().userCredential.count()).toBe(1);
    expect(await testDb().userAccount.count()).toBe(1);
  });

  it.each([
    ["no-at-sign", PASSWORD, "Sam"],
    ["missing@domain", PASSWORD, "Sam"],
    ["two@@ats.test", PASSWORD, "Sam"],
    ["parent@family.test", "too-short", "Sam"],
    ["parent@family.test", PASSWORD, "   "],
  ])("rejects registration with email=%s password=%s name=%s", async (email, password, displayName) => {
    const { app } = makeApp();
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password, displayName });

    expect(response.status).toBe(422);
    expect(await testDb().userAccount.count()).toBe(0);
  });

  it("signs in with the right password and refuses everything else identically", async () => {
    const { app } = makeApp();
    await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "parent@family.test", password: PASSWORD, displayName: "Sam" });

    const good = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "Parent@Family.TEST", password: PASSWORD });
    expect(good.status).toBe(200);
    expect(good.body.account.email).toBe("parent@family.test");

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "parent@family.test", password: "not-the-passphrase" });
    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@family.test", password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical bodies: login must not disclose which addresses exist.
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("returns the signed-in account and rejects unusable tokens", async () => {
    const { app } = makeApp();
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "parent@family.test", password: PASSWORD, displayName: "Sam" });
    const token = registered.body.accessToken as string;

    const me = await request(app)
      .get("/api/v1/me")
      .set("authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.displayName).toBe("Sam");

    expect((await request(app).get("/api/v1/me")).status).toBe(401);
    expect(
      (await request(app).get("/api/v1/me").set("authorization", "Bearer nope"))
        .status,
    ).toBe(401);
  });

  it("revokes the session on logout", async () => {
    const { app } = makeApp();
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "parent@family.test", password: PASSWORD, displayName: "Sam" });
    const token = registered.body.accessToken as string;

    const loggedOut = await request(app)
      .post("/api/v1/auth/logout")
      .set("authorization", `Bearer ${token}`);
    expect(loggedOut.status).toBe(204);

    const after = await request(app)
      .get("/api/v1/me")
      .set("authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);

    const session = await testDb().accessSession.findFirstOrThrow({});
    expect(session.revokedAt).not.toBeNull();
  });

  it("keeps the two sign-in routes separate", async () => {
    await addUniversity(testDb());
    const { app, gateway } = makeApp();
    gateway.set("active@demo.edu", activeVerification("s-1"));

    // A passwordless university session is a valid bearer token, but it is not
    // a credential account and must not resolve at /me.
    const challenge = await request(app)
      .post("/api/v1/auth/challenges")
      .send({ email: "active@demo.edu" });
    const verified = await request(app)
      .post("/api/v1/auth/challenges/verify")
      .send({
        challengeId: challenge.body.challengeId,
        code: "123456",
        username: "kilowatt_kid",
      });
    expect(verified.status).toBe(200);

    const me = await request(app)
      .get("/api/v1/me")
      .set("authorization", `Bearer ${verified.body.accessToken}`);
    expect(me.status).toBe(401);

    // And a credential session has no university profile.
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "parent@family.test", password: PASSWORD, displayName: "Sam" });
    const profile = await request(app)
      .get("/api/v1/me/profile")
      .set("authorization", `Bearer ${registered.body.accessToken}`);
    expect(profile.status).toBe(401);
  });
});
