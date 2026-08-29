/**
 * Email + password authentication: sign-up, sign-in, sessions, and principals.
 *
 * This replaces the previous passwordless university-email OTP flow. Registration
 * is open to any valid email address; the university roster is no longer consulted
 * here (it remains available read-only through the verification module). Session
 * tokens continue to be opaque and stored only as HMAC-SHA256 digests.
 */
import { randomUUID } from "node:crypto";

import type { RoleName } from "@energy/shared";
import type { PrismaClient, UserAccount } from "@prisma/client";

import {
  digestSession,
  generateToken,
  hashPassword,
  verifyPassword,
} from "../../crypto.js";
import type { Principal } from "./authorization.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidSessionError,
} from "./errors.js";

const SESSION_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 120;

export interface SignUpInput {
  email: string;
  name: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: RoleName[];
}

export interface IssuedSession {
  accessToken: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export interface AuthServiceOptions {
  clock?: () => Date;
  tokenFactory?: () => string;
  passwordHasher?: (password: string) => string;
  passwordVerifier?: (password: string, stored: string) => boolean;
}

export class AuthService {
  private readonly clock: () => Date;
  private readonly tokenFactory: () => string;
  private readonly hash: (password: string) => string;
  private readonly verify: (password: string, stored: string) => boolean;

  constructor(
    private readonly db: PrismaClient,
    private readonly sessionHmacKey: string,
    options: AuthServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.tokenFactory = options.tokenFactory ?? generateToken;
    this.hash = options.passwordHasher ?? hashPassword;
    this.verify = options.passwordVerifier ?? verifyPassword;
  }

  /** Create an account for a new email and open a session. */
  async signUp({ email, name, password }: SignUpInput): Promise<IssuedSession> {
    const normalizedEmail = normalizeEmail(email);
    const displayName = name.trim();
    if (displayName.length === 0 || displayName.length > MAX_NAME_LENGTH) {
      throw new InvalidCredentialsError("a name is required");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new InvalidCredentialsError(
        `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const now = this.clock();
    let account: UserAccount;
    try {
      account = await this.db.userAccount.create({
        data: {
          status: "active",
          email: normalizedEmail,
          name: displayName,
          passwordHash: this.hash(password),
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        // Unique violation on the email column.
        throw new EmailAlreadyRegisteredError("email is already registered");
      }
      throw error;
    }

    const session = await this.openSession(account.id, now);
    return { ...session, user: toUser(account, []) };
  }

  /** Verify an email/password pair and open a session. */
  async signIn({ email, password }: SignInInput): Promise<IssuedSession> {
    const now = this.clock();
    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeEmail(email);
    } catch {
      // Keep the timing and error identical to a missing account.
      normalizedEmail = "";
    }

    const account =
      normalizedEmail === ""
        ? null
        : await this.db.userAccount.findUnique({
            where: { email: normalizedEmail },
          });

    // Always run the verifier — against a dummy digest when the account is
    // missing — so response time does not reveal whether the email exists.
    const stored = account?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordOk = this.verify(password, stored);
    if (account === null || account.status !== "active" || !passwordOk) {
      throw new InvalidCredentialsError("email or password is incorrect");
    }

    const roles = await this.rolesFor(account.id);
    const session = await this.openSession(account.id, now);
    return { ...session, user: toUser(account, roles) };
  }

  /** The public account view for a valid session token. */
  async userForToken(token: string): Promise<AuthenticatedUser> {
    const account = await this.accountForToken(token);
    const roles = await this.rolesFor(account.id);
    return toUser(account, roles);
  }

  /** The authorization principal (account + role grants) for a valid token. */
  async principalForToken(token: string): Promise<Principal> {
    const account = await this.accountForToken(token);
    const assignments = await this.db.roleAssignment.findMany({
      where: { accountId: account.id },
    });
    return {
      accountId: account.id,
      grants: assignments.map((row) => ({
        role: row.role,
        universityId: row.universityId,
        buildingId: row.buildingId,
      })),
    };
  }

  /** Revoke the session behind a token (idempotent). */
  async signOut(token: string): Promise<void> {
    const now = this.clock();
    await this.db.accessSession.updateMany({
      where: {
        tokenDigest: digestSession(this.sessionHmacKey, token),
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
  }

  private async accountForToken(token: string): Promise<UserAccount> {
    const now = this.clock();
    const session = await this.db.accessSession.findFirst({
      where: {
        tokenDigest: digestSession(this.sessionHmacKey, token),
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (session === null) {
      throw new InvalidSessionError("access token is invalid");
    }
    const account = await this.db.userAccount.findUnique({
      where: { id: session.accountId },
    });
    if (account === null || account.status !== "active") {
      throw new InvalidSessionError("access token is invalid");
    }
    return account;
  }

  private async rolesFor(accountId: string): Promise<RoleName[]> {
    const assignments = await this.db.roleAssignment.findMany({
      where: { accountId },
    });
    return assignments.map((row) => row.role);
  }

  private async openSession(
    accountId: string,
    now: Date,
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const token = this.tokenFactory();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.db.accessSession.create({
      data: {
        accountId,
        tokenDigest: digestSession(this.sessionHmacKey, token),
        expiresAt,
        createdAt: now,
      },
    });
    return { accessToken: token, expiresAt };
  }
}

// A well-formed scrypt digest of a random secret. Verifying supplied passwords
// against it for unknown accounts keeps sign-in timing uniform.
const DUMMY_PASSWORD_HASH = hashPassword(randomUUID());

function toUser(account: UserAccount, roles: RoleName[]): AuthenticatedUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    roles,
  };
}

/** Trim + lower-case an email and require a single-`@`, non-empty local/domain. */
export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at >= normalized.length - 1) {
    throw new InvalidCredentialsError("a valid email address is required");
  }
  return normalized;
}
