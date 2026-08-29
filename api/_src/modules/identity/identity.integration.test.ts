/**
 * REQ-ID-001/002/003 identity behaviour and privacy outcomes
 * (port of tests/integration/test_identity_api.py). Requires TEST_DATABASE_URL.
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
import {
  activeVerification,
  addUniversity,
  CHALLENGE_KEY,
  FakeUniversityGateway,
  MutableClock,
  NOW,
  SESSION_KEY,
  testConfig,
} from "../../test/fixtures.js";
import type { UniversityVerification } from "../university/contracts.js";
import {
  ChallengeRateLimitError,
  InvalidChallengeError,
  InvalidSessionError,
  RosterIneligibleError,
  UniversityDomainError,
  UsernameUnavailableError,
} from "./errors.js";
import { InMemoryEmailCodeSender } from "./ports.js";
import { IdentityService } from "./service.js";

const TEN_MIN_MS = 10 * 60 * 1000;

function makeService(
  gateway: FakeUniversityGateway,
  sender: InMemoryEmailCodeSender,
  clock: MutableClock,
  { code = "123456", token = "private-access-token" } = {},
): IdentityService {
  return new IdentityService(testDb(), gateway, sender, CHALLENGE_KEY, SESSION_KEY, {
    clock: clock.fn,
    codeFactory: () => code,
    tokenFactory: () => token,
  });
}

async function activate(
  service: IdentityService,
  gateway: FakeUniversityGateway,
  email: string,
  username: string,
  studentReference: string,
): Promise<string> {
  gateway.set(email, activeVerification(studentReference));
  const issued = await service.requestChallenge(email);
  const activated = await service.verifyChallenge(issued.challengeId, "123456", username);
  return activated.accessToken;
}

describeIntegration("identity service", () => {
  beforeAll(() => ensureSchema());
  beforeEach(() => resetDatabase());
  afterAll(() => disconnect());

  it("requires a university domain without creating an account", async () => {
    await addUniversity(testDb());
    const service = makeService(new FakeUniversityGateway(), new InMemoryEmailCodeSender(), new MutableClock());

    const issued = await service.requestChallenge("Student@Demo.Edu");
    expect(issued.expiresAt.getTime()).toBe(NOW.getTime() + TEN_MIN_MS);
    expect(await testDb().userAccount.count()).toBe(0);
    await expect(service.requestChallenge("person@gmail.com")).rejects.toBeInstanceOf(UniversityDomainError);
    expect(await testDb().userAccount.count()).toBe(0);
  });

  it("activates a valid code once and stores private roster state", async () => {
    const uni = await addUniversity(testDb());
    const gateway = new FakeUniversityGateway();
    const sender = new InMemoryEmailCodeSender();
    const service = makeService(gateway, sender, new MutableClock());
    gateway.set("active@demo.edu", activeVerification("student-active"));
    const issued = await service.requestChallenge("active@demo.edu");

    const activated = await service.verifyChallenge(issued.challengeId, "123456", "EcoHero");

    expect(activated.accessToken).toBe("private-access-token");
    expect(activated.roles).toEqual(["participant"]);
    expect(sender.codeFor("active@demo.edu")).toBe("123456");
    const identity = await testDb().universityIdentity.findFirst();
    const residence = await testDb().verifiedResidence.findFirst();
    const session = await testDb().accessSession.findFirst();
    expect(identity?.universityId).toBe(uni.id);
    expect(identity?.normalizedEmail).toBe("active@demo.edu");
    expect(residence?.apartmentReference).toBe("hall-1-a01");
    expect(session?.tokenDigest).not.toBe(activated.accessToken);
    await expect(service.verifyChallenge(issued.challengeId, "123456", "EcoHero")).rejects.toBeInstanceOf(InvalidChallengeError);
  });

  it("rejects expired, reused, and incorrect codes", async () => {
    await addUniversity(testDb());
    const clock = new MutableClock();
    const service = makeService(new FakeUniversityGateway(), new InMemoryEmailCodeSender(), clock);

    const expired = await service.requestChallenge("expired@demo.edu");
    clock.advanceMinutes(11);
    await expect(service.verifyChallenge(expired.challengeId, "123456", "ExpiredUser")).rejects.toBeInstanceOf(InvalidChallengeError);

    clock.now = NOW;
    const limited = await service.requestChallenge("attempts@demo.edu");
    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyChallenge(limited.challengeId, "000000", "AttemptUser")).rejects.toBeInstanceOf(InvalidChallengeError);
    }
    await expect(service.verifyChallenge(limited.challengeId, "123456", "AttemptUser")).rejects.toBeInstanceOf(InvalidChallengeError);
    const challenge = await testDb().emailChallenge.findUnique({ where: { id: limited.challengeId } });
    expect(challenge?.attempts).toBe(5);
  });

  it("enforces the challenge request rate limit", async () => {
    await addUniversity(testDb());
    const service = makeService(new FakeUniversityGateway(), new InMemoryEmailCodeSender(), new MutableClock());
    for (let i = 0; i < 3; i += 1) {
      await service.requestChallenge("rate@demo.edu");
    }
    await expect(service.requestChallenge("rate@demo.edu")).rejects.toBeInstanceOf(ChallengeRateLimitError);
  });

  const ineligible: UniversityVerification[] = [
    { status: "not_found", universityReference: null, studentReference: null, residence: null },
    { status: "inactive", universityReference: "demo-university", studentReference: "inactive-student", residence: null },
    { status: "active", universityReference: "demo-university", studentReference: "no-residence", residence: null },
  ];
  it.each(ineligible)("never creates a participant for an ineligible result %#", async (verification) => {
    await addUniversity(testDb());
    const gateway = new FakeUniversityGateway();
    gateway.set("ineligible@demo.edu", verification);
    const service = makeService(gateway, new InMemoryEmailCodeSender(), new MutableClock());
    const issued = await service.requestChallenge("ineligible@demo.edu");

    await expect(service.verifyChallenge(issued.challengeId, "123456", "NoEntry")).rejects.toBeInstanceOf(RosterIneligibleError);

    expect(await testDb().userAccount.count()).toBe(0);
    const challenge = await testDb().emailChallenge.findUnique({ where: { id: issued.challengeId } });
    expect(challenge?.consumedAt?.getTime()).toBe(NOW.getTime());
  });

  it("keeps usernames unique within a university but reusable across tenants", async () => {
    await addUniversity(testDb());
    await addUniversity(testDb(), { name: "Other University", domain: "other.edu", rosterReference: "other-university" });
    const gateway = new FakeUniversityGateway();
    const sender = new InMemoryEmailCodeSender();
    const service = makeService(gateway, sender, new MutableClock());
    await activate(service, gateway, "first@demo.edu", "SharedName", "student-1");

    gateway.set("second@demo.edu", activeVerification("student-2"));
    const second = await service.requestChallenge("second@demo.edu");
    await expect(service.verifyChallenge(second.challengeId, "123456", "sharedname")).rejects.toBeInstanceOf(UsernameUnavailableError);

    gateway.set("other@other.edu", activeVerification("other-student", "other-university"));
    const otherService = makeService(gateway, sender, new MutableClock(), { token: "other-access-token" });
    const other = await otherService.requestChallenge("other@other.edu");
    await otherService.verifyChallenge(other.challengeId, "123456", "SharedName");

    const profiles = await testDb().userProfile.findMany();
    expect(profiles).toHaveLength(2);
    expect(profiles.every((p) => p.username === "SharedName")).toBe(true);
    expect(profiles[0]!.universityId).not.toBe(profiles[1]!.universityId);
  });

  it("rejects a revoked session", async () => {
    await addUniversity(testDb());
    const gateway = new FakeUniversityGateway();
    const service = makeService(gateway, new InMemoryEmailCodeSender(), new MutableClock());
    const token = await activate(service, gateway, "active@demo.edu", "EcoHero", "student-1");

    const principal = await service.principalForToken(token);
    expect(principal.grants[0]!.role).toBe("participant");

    const session = await testDb().accessSession.findFirstOrThrow();
    await testDb().accessSession.update({ where: { id: session.id }, data: { revokedAt: NOW } });
    await expect(service.principalForToken(token)).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("returns only public session fields and leaks no secrets over HTTP", async () => {
    await addUniversity(testDb());
    const gateway = new FakeUniversityGateway();
    gateway.set("active@demo.edu", activeVerification("student-active"));
    const sender = new InMemoryEmailCodeSender();
    const app = createApp({
      config: testConfig(),
      db: testDb(),
      gateway,
      sender,
      clock: new MutableClock().fn,
      codeFactory: () => "123456",
      tokenFactory: () => "api-private-token",
      enableDevInbox: false,
    });
    const agent = request(app);

    const challenge = await agent.post("/api/v1/auth/challenges").send({ email: "active@demo.edu" });
    expect(challenge.status).toBe(202);
    const verify = await agent.post("/api/v1/auth/challenges/verify").send({
      challengeId: challenge.body.challengeId,
      code: sender.codeFor("active@demo.edu"),
      username: "EcoHero",
    });

    expect(verify.status).toBe(200);
    expect(new Set(Object.keys(verify.body))).toEqual(
      new Set(["accessToken", "tokenType", "expiresAt", "username", "roles"]),
    );
    const serialized = JSON.stringify(verify.body);
    expect(serialized).not.toContain("active@demo.edu");
    expect(serialized).not.toContain("hall-1-a01");
    expect(serialized).not.toContain("123456");

    const rename = await agent
      .patch("/api/v1/me/username")
      .set("Authorization", "Bearer api-private-token")
      .send({ username: "EcoLeader" });
    expect(rename.status).toBe(200);
    expect(rename.body).toEqual({ username: "EcoLeader" });
  });
});
