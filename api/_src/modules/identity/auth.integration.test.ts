/**
 * Email + password sign-up / sign-in / session behaviour and privacy outcomes.
 * Requires TEST_DATABASE_URL (self-skips otherwise).
 */
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
import { MutableClock, NOW, SESSION_KEY, testConfig } from "../../test/fixtures.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidSessionError,
} from "./errors.js";
import { AuthService } from "./service.js";

const HOUR_MS = 60 * 60 * 1000;

function makeService(
  clock: MutableClock = new MutableClock(),
  token = "private-access-token",
): AuthService {
  return new AuthService(testDb(), SESSION_KEY, {
    clock: clock.fn,
    tokenFactory: () => token,
  });
}

describeIntegration("auth service", () => {
  beforeAll(() => ensureSchema());
  beforeEach(() => resetDatabase());
  afterAll(() => disconnect());

  it("signs up a new account, hashes the password, and opens a session", async () => {
    const service = makeService();
    const issued = await service.signUp({
      email: "New@Demo.Edu",
      name: "  New User ",
      password: "password123",
    });

    expect(issued.accessToken).toBe("private-access-token");
    expect(issued.user.email).toBe("new@demo.edu");
    expect(issued.user.name).toBe("New User");
    expect(issued.user.roles).toEqual([]);
    expect(issued.expiresAt.getTime()).toBe(NOW.getTime() + HOUR_MS);

    const account = await testDb().userAccount.findUniqueOrThrow({
      where: { email: "new@demo.edu" },
    });
    expect(account.passwordHash).not.toContain("password123");
    const session = await testDb().accessSession.findFirstOrThrow();
    expect(session.tokenDigest).not.toBe(issued.accessToken);
  });

  it("rejects a duplicate email regardless of case", async () => {
    const service = makeService();
    await service.signUp({ email: "dup@demo.edu", name: "First", password: "password123" });
    await expect(
      service.signUp({ email: "DUP@demo.edu", name: "Second", password: "password123" }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(await testDb().userAccount.count()).toBe(1);
  });

  it("signs in with the correct password and rejects wrong/unknown ones", async () => {
    await makeService().signUp({ email: "user@demo.edu", name: "User", password: "password123" });

    const signedIn = await makeService(new MutableClock(), "signin-token").signIn({
      email: "User@Demo.edu",
      password: "password123",
    });
    expect(signedIn.accessToken).toBe("signin-token");
    expect(signedIn.user.email).toBe("user@demo.edu");

    await expect(
      makeService().signIn({ email: "user@demo.edu", password: "wrong-password" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      makeService().signIn({ email: "missing@demo.edu", password: "password123" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("resolves a session token and revokes it on sign-out", async () => {
    const service = makeService();
    const issued = await service.signUp({
      email: "session@demo.edu",
      name: "Session",
      password: "password123",
    });

    const user = await service.userForToken(issued.accessToken);
    expect(user.email).toBe("session@demo.edu");

    await service.signOut(issued.accessToken);
    await expect(service.userForToken(issued.accessToken)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it("exposes only public fields and leaks no secrets over HTTP", async () => {
    const app = createApp({
      config: testConfig(),
      db: testDb(),
      clock: new MutableClock().fn,
      tokenFactory: () => "api-private-token",
    });
    const agent = request(app);

    const signUp = await agent
      .post("/api/v1/auth/sign-up")
      .send({ email: "http@demo.edu", name: "Http User", password: "password123" });
    expect(signUp.status).toBe(201);
    expect(new Set(Object.keys(signUp.body))).toEqual(
      new Set(["accessToken", "tokenType", "expiresAt", "user"]),
    );
    expect(new Set(Object.keys(signUp.body.user))).toEqual(
      new Set(["id", "email", "name", "roles"]),
    );
    expect(JSON.stringify(signUp.body)).not.toContain("password123");

    const me = await agent
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer api-private-token");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("http@demo.edu");

    const dupe = await agent
      .post("/api/v1/auth/sign-up")
      .send({ email: "http@demo.edu", name: "Other", password: "password123" });
    expect(dupe.status).toBe(409);

    const badSignIn = await agent
      .post("/api/v1/auth/sign-in")
      .send({ email: "http@demo.edu", password: "not-the-password" });
    expect(badSignIn.status).toBe(401);

    const signOut = await agent
      .post("/api/v1/auth/sign-out")
      .set("Authorization", "Bearer api-private-token");
    expect(signOut.status).toBe(204);

    const afterOut = await agent
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer api-private-token");
    expect(afterOut.status).toBe(401);
  });
});
