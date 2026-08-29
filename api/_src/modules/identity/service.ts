/**
 * Passwordless activation, sessions, usernames, and principals
 * (port of platform_app.modules.identity.service).
 */
import { randomUUID } from "node:crypto";

import type { RoleName } from "@energy/shared";
import type { PrismaClient } from "@prisma/client";

import {
  digestChallenge,
  digestSession,
  digestsEqual,
  generateCode,
  generateToken,
} from "../../crypto.js";
import type { PrismaTransaction } from "../../db.js";
import type {
  UniversityVerificationGateway,
  VerifiedResidenceContract,
} from "../university/contracts.js";
import type { Principal } from "./authorization.js";
import {
  InvalidChallengeError,
  InvalidSessionError,
  RosterIneligibleError,
  UniversityDomainError,
  UsernameUnavailableError,
  ChallengeRateLimitError,
} from "./errors.js";
import type { EmailCodeSender } from "./ports.js";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 3;
const SESSION_TTL_MS = 60 * 60 * 1000;

export interface ChallengeIssued {
  challengeId: string;
  expiresAt: Date;
}

export interface ActivatedSession {
  accessToken: string;
  expiresAt: Date;
  username: string;
  roles: RoleName[];
}

export interface IdentityServiceOptions {
  clock?: () => Date;
  codeFactory?: () => string;
  tokenFactory?: () => string;
}

export class IdentityService {
  private readonly clock: () => Date;
  private readonly codeFactory: () => string;
  private readonly tokenFactory: () => string;

  constructor(
    private readonly db: PrismaClient,
    private readonly gateway: UniversityVerificationGateway,
    private readonly emailSender: EmailCodeSender,
    private readonly challengeHmacKey: string,
    private readonly sessionHmacKey: string,
    options: IdentityServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.codeFactory = options.codeFactory ?? generateCode;
    this.tokenFactory = options.tokenFactory ?? generateToken;
  }

  async requestChallenge(email: string): Promise<ChallengeIssued> {
    const [normalizedEmail, domain] = normalizeEmail(email);
    const university = await this.db.university.findFirst({
      where: {
        status: "active",
        emailDomains: { some: { normalizedDomain: domain } },
      },
    });
    if (university === null || university.rosterReference === null) {
      throw new UniversityDomainError("email is not eligible for participation");
    }

    const now = this.clock();
    const recentCount = await this.db.emailChallenge.count({
      where: {
        normalizedEmail,
        createdAt: { gte: new Date(now.getTime() - RATE_WINDOW_MS) },
      },
    });
    if (recentCount >= RATE_LIMIT) {
      throw new ChallengeRateLimitError("too many verification requests");
    }

    const challengeId = randomUUID();
    const code = this.codeFactory();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
    await this.db.emailChallenge.create({
      data: {
        id: challengeId,
        universityId: university.id,
        normalizedEmail,
        codeDigest: digestChallenge(this.challengeHmacKey, challengeId, code),
        expiresAt,
        attempts: 0,
        maxAttempts: 5,
        createdAt: now,
      },
    });
    await this.emailSender.sendCode(normalizedEmail, code, expiresAt);
    return { challengeId, expiresAt };
  }

  async verifyChallenge(
    challengeId: string,
    code: string,
    username: string,
  ): Promise<ActivatedSession> {
    const now = this.clock();
    const challenge = await this.db.emailChallenge.findUnique({
      where: { id: challengeId },
    });
    if (
      challenge === null ||
      challenge.consumedAt !== null ||
      challenge.expiresAt.getTime() <= now.getTime() ||
      challenge.attempts >= challenge.maxAttempts
    ) {
      throw new InvalidChallengeError("verification code is invalid");
    }

    const expectedDigest = digestChallenge(
      this.challengeHmacKey,
      challenge.id,
      code,
    );
    if (!digestsEqual(challenge.codeDigest, expectedDigest)) {
      // Persist the failed attempt even though we reject the request.
      await this.db.emailChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new InvalidChallengeError("verification code is invalid");
    }

    const verification = await this.gateway.verifyResident(
      challenge.normalizedEmail,
      now,
    );
    const university = await this.db.university.findUnique({
      where: { id: challenge.universityId },
    });
    if (
      university === null ||
      verification.status !== "active" ||
      verification.residence === null ||
      verification.studentReference === null ||
      verification.universityReference !== university.rosterReference
    ) {
      await this.db.emailChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
      throw new RosterIneligibleError(
        "active enrolment and residence are required",
      );
    }

    const normalizedUsername = normalizeUsername(username);
    const studentReference = verification.studentReference;
    const residence = verification.residence;
    const universityId = university.id;

    // Atomic activation: on a username conflict the whole account/identity
    // creation rolls back (matching the original session.rollback() on 409).
    return this.db.$transaction(async (tx) => {
      let identity = await tx.universityIdentity.findFirst({
        where: { universityId, normalizedEmail: challenge.normalizedEmail },
      });
      let accountId: string;
      if (identity === null) {
        const account = await tx.userAccount.create({
          data: { status: "active" },
        });
        accountId = account.id;
        identity = await tx.universityIdentity.create({
          data: {
            universityId,
            accountId: account.id,
            normalizedEmail: challenge.normalizedEmail,
            externalStudentReference: studentReference,
            enrollmentState: "active",
          },
        });
      } else {
        const existingAccount = await tx.userAccount.findUnique({
          where: { id: identity.accountId },
        });
        if (existingAccount === null || existingAccount.status !== "active") {
          throw new RosterIneligibleError("account is not active");
        }
        accountId = existingAccount.id;
        identity = await tx.universityIdentity.update({
          where: { id: identity.id },
          data: {
            externalStudentReference: studentReference,
            enrollmentState: "active",
          },
        });
      }

      const profile = await upsertProfile(
        tx,
        identity.id,
        universityId,
        username,
        normalizedUsername,
      );
      await upsertParticipantRole(tx, accountId, universityId);
      await recordResidence(tx, identity.id, universityId, residence, now);
      await tx.emailChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });

      const token = this.tokenFactory();
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      await tx.accessSession.create({
        data: {
          accountId,
          tokenDigest: digestSession(this.sessionHmacKey, token),
          expiresAt,
          createdAt: now,
        },
      });

      return {
        accessToken: token,
        expiresAt,
        username: profile.username,
        roles: ["participant"] satisfies RoleName[],
      };
    });
  }

  async principalForToken(token: string): Promise<Principal> {
    const now = this.clock();
    const accessSession = await this.db.accessSession.findFirst({
      where: {
        tokenDigest: digestSession(this.sessionHmacKey, token),
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (accessSession === null) {
      throw new InvalidSessionError("access token is invalid");
    }
    const assignments = await this.db.roleAssignment.findMany({
      where: { accountId: accessSession.accountId },
    });
    return {
      accountId: accessSession.accountId,
      grants: assignments.map((row) => ({
        role: row.role,
        universityId: row.universityId,
        buildingId: row.buildingId,
      })),
    };
  }

  async changeUsername(principal: Principal, username: string): Promise<string> {
    const normalized = normalizeUsername(username);
    const identity = await this.db.universityIdentity.findFirst({
      where: { accountId: principal.accountId },
    });
    if (identity === null) {
      throw new InvalidSessionError("participant identity is missing");
    }
    const profile = await this.db.userProfile.findFirst({
      where: { identityId: identity.id },
    });
    if (profile === null) {
      throw new InvalidSessionError("participant profile is missing");
    }
    const existing = await this.db.userProfile.findFirst({
      where: {
        universityId: identity.universityId,
        normalizedUsername: normalized,
        id: { not: profile.id },
      },
    });
    if (existing !== null) {
      throw new UsernameUnavailableError("username is unavailable");
    }
    const updated = await this.db.userProfile.update({
      where: { id: profile.id },
      data: { username, normalizedUsername: normalized },
    });
    return updated.username;
  }
}

async function upsertProfile(
  tx: PrismaTransaction,
  identityId: string,
  universityId: string,
  username: string,
  normalizedUsername: string,
) {
  const conflict = await tx.userProfile.findFirst({
    where: {
      universityId,
      normalizedUsername,
      identityId: { not: identityId },
    },
  });
  if (conflict !== null) {
    throw new UsernameUnavailableError("username is unavailable");
  }
  const existing = await tx.userProfile.findUnique({ where: { identityId } });
  if (existing === null) {
    return tx.userProfile.create({
      data: {
        universityId,
        identityId,
        username,
        normalizedUsername,
        moderationState: "active",
      },
    });
  }
  return tx.userProfile.update({
    where: { id: existing.id },
    data: { username, normalizedUsername },
  });
}

async function upsertParticipantRole(
  tx: PrismaTransaction,
  accountId: string,
  universityId: string,
): Promise<void> {
  const existing = await tx.roleAssignment.findFirst({
    where: { accountId, role: "participant", universityId },
  });
  if (existing === null) {
    await tx.roleAssignment.create({
      data: { accountId, role: "participant", universityId, buildingId: null },
    });
  }
}

async function recordResidence(
  tx: PrismaTransaction,
  identityId: string,
  universityId: string,
  residence: VerifiedResidenceContract,
  now: Date,
): Promise<void> {
  const current = await tx.verifiedResidence.findFirst({
    where: { identityId, effectiveEnd: null },
  });
  if (current !== null) {
    const unchanged =
      current.buildingReference === residence.buildingReference &&
      current.apartmentReference === residence.apartmentReference &&
      current.roomReference === residence.roomReference &&
      current.sourceVersion === residence.sourceVersion;
    if (unchanged) {
      await tx.verifiedResidence.update({
        where: { id: current.id },
        data: { verifiedAt: now },
      });
      return;
    }
    await tx.verifiedResidence.update({
      where: { id: current.id },
      data: { effectiveEnd: now },
    });
  }
  await tx.verifiedResidence.create({
    data: {
      universityId,
      identityId,
      buildingReference: residence.buildingReference,
      apartmentReference: residence.apartmentReference,
      roomReference: residence.roomReference,
      sourceVersion: residence.sourceVersion,
      effectiveStart: now,
      effectiveEnd: null,
      verifiedAt: now,
    },
  });
}

export function normalizeEmail(email: string): [string, string] {
  const normalized = email.trim().toLowerCase();
  const separatorIndex = normalized.lastIndexOf("@");
  if (separatorIndex <= 0 || separatorIndex >= normalized.length - 1) {
    throw new UniversityDomainError("email is not eligible for participation");
  }
  const domain = normalized.slice(separatorIndex + 1);
  return [normalized, domain];
}

export function normalizeUsername(username: string): string {
  if (!USERNAME_PATTERN.test(username)) {
    throw new UsernameUnavailableError(
      "username must contain 3-24 letters, numbers, or underscores",
    );
  }
  return username.toLowerCase();
}
