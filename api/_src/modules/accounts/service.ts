/**
 * Email + password registration, sign-in, and session lifecycle.
 *
 * Sessions reuse the existing access_session table and HMAC digest scheme, so
 * a credential session and a passwordless session are the same kind of bearer
 * token and only the way they were obtained differs.
 */
import type { PrismaClient, UserCredential } from "@prisma/client";

import { digestSession, generateToken } from "../../crypto.js";
import {
  AccountSessionError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "./errors.js";
import {
  assertUsablePassword,
  normalizeAccountEmail,
  normalizeDisplayName,
} from "./normalize.js";
import { hashPassword, verifyPassword } from "./password.js";

/** Seven days: long enough that a sign-in page is not a nuisance. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A hash of a value nobody can supply, used to spend comparable time when the
 * email is unknown so login timing does not disclose which addresses exist.
 */
const DECOY_HASH_PROMISE = hashPassword(generateToken());

export interface AccountSession {
  accessToken: string;
  expiresAt: Date;
  credential: UserCredential;
}

export interface AccountServiceOptions {
  clock?: () => Date;
  tokenFactory?: () => string;
}

export class AccountService {
  private readonly clock: () => Date;
  private readonly tokenFactory: () => string;

  constructor(
    private readonly db: PrismaClient,
    private readonly sessionHmacKey: string,
    options: AccountServiceOptions = {},
  ) {
    this.clock = options.clock ?? ((): Date => new Date());
    this.tokenFactory = options.tokenFactory ?? generateToken;
  }

  /** Create an account and open a session for it. */
  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<AccountSession> {
    const normalizedEmail = normalizeAccountEmail(email);
    const name = normalizeDisplayName(displayName);
    assertUsablePassword(password);
    const passwordHash = await hashPassword(password);

    const existing = await this.db.userCredential.findUnique({
      where: { normalizedEmail },
    });
    if (existing !== null) {
      throw new EmailAlreadyRegisteredError("email is already registered");
    }

    const credential = await this.db
      .$transaction(async (tx) => {
        const account = await tx.userAccount.create({
          data: { status: "active" },
        });
        return tx.userCredential.create({
          data: {
            accountId: account.id,
            normalizedEmail,
            displayName: name,
            passwordHash,
          },
        });
      })
      .catch((error: unknown) => {
        // Two concurrent registrations for one address: the unique index
        // decides, and the loser is told the address is taken.
        if (isUniqueViolation(error)) {
          throw new EmailAlreadyRegisteredError("email is already registered");
        }
        throw error;
      });

    return this.openSession(credential);
  }

  /** Verify a password and open a session. */
  async login(email: string, password: string): Promise<AccountSession> {
    let normalizedEmail: string;
    try {
      normalizedEmail = normalizeAccountEmail(email);
    } catch {
      // A malformed address is simply not a known credential.
      throw new InvalidCredentialsError("email or password is incorrect");
    }
    const credential = await this.db.userCredential.findUnique({
      where: { normalizedEmail },
      include: { account: true },
    });
    if (credential === null) {
      await verifyPassword(password, await DECOY_HASH_PROMISE);
      throw new InvalidCredentialsError("email or password is incorrect");
    }
    const matches = await verifyPassword(password, credential.passwordHash);
    if (!matches || credential.account.status !== "active") {
      throw new InvalidCredentialsError("email or password is incorrect");
    }
    return this.openSession(credential);
  }

  /** The credential behind a bearer token. */
  async credentialForToken(token: string): Promise<UserCredential> {
    const now = this.clock();
    const session = await this.db.accessSession.findFirst({
      where: {
        tokenDigest: digestSession(this.sessionHmacKey, token),
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (session === null) {
      throw new AccountSessionError("access token is invalid");
    }
    const credential = await this.db.userCredential.findUnique({
      where: { accountId: session.accountId },
    });
    if (credential === null) {
      // A valid session for an account that has no password credential (for
      // example a passwordless university participant).
      throw new AccountSessionError("access token is invalid");
    }
    return credential;
  }

  /** Revoke the presented session. Idempotent. */
  async logout(token: string): Promise<void> {
    const now = this.clock();
    await this.db.accessSession.updateMany({
      where: {
        tokenDigest: digestSession(this.sessionHmacKey, token),
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
  }

  private async openSession(credential: UserCredential): Promise<AccountSession> {
    const now = this.clock();
    const token = this.tokenFactory();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.db.accessSession.create({
      data: {
        accountId: credential.accountId,
        tokenDigest: digestSession(this.sessionHmacKey, token),
        expiresAt,
        createdAt: now,
      },
    });
    return { accessToken: token, expiresAt, credential };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}
