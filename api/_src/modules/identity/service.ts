/**
 * Email + password authentication, backed by MongoDB.
 *
 * Accounts live in the `users` collection. A successful sign-up or sign-in
 * issues an opaque bearer token whose HMAC digest is stored in the `sessions`
 * collection — the raw token never touches the database. Tokens are validated by
 * digest lookup and expire after {@link DEFAULT_SESSION_TTL_MS}; sign-out simply
 * deletes the session row.
 *
 * Dependencies (clock, token factory, database handle) are injectable so the
 * service can be driven deterministically in tests.
 */
import { MongoServerError, type Db } from "mongodb";

import { digestSession, generateToken, verifyPassword } from "../../crypto.js";
import { getDb } from "../../db.js";
import {
  sessionsCollection,
  usersCollection,
  type SessionDocument,
  type UserDocument,
} from "../../persistence/collections.js";
import { newUserDocument } from "../../persistence/schemas.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidSessionError,
  UsernameAlreadyTakenError,
} from "./errors.js";

export interface SignUpInput {
  email: string;
  username: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
}

export interface IssuedSession {
  accessToken: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export interface AuthServiceOptions {
  clock?: () => Date;
  tokenFactory?: () => string;
  /** Database handle provider; defaults to the shared connection. */
  db?: () => Promise<Db>;
  /** Session lifetime in milliseconds (default 7 days). */
  sessionTtlMs?: number;
}

/** Seven days, in milliseconds. */
export const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthService {
  private readonly now: () => Date;
  private readonly newToken: () => string;
  private readonly db: () => Promise<Db>;
  private readonly ttlMs: number;

  constructor(
    private readonly sessionHmacKey: string,
    options: AuthServiceOptions = {},
  ) {
    this.now = options.clock ?? (() => new Date());
    this.newToken = options.tokenFactory ?? generateToken;
    this.db = options.db ?? getDb;
    this.ttlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  async signUp(input: SignUpInput): Promise<IssuedSession> {
    const db = await this.db();
    const doc = newUserDocument(input, this.now());
    try {
      await usersCollection(db).insertOne(doc);
    } catch (error) {
      const field = duplicateField(error);
      if (field === "email") {
        throw new EmailAlreadyRegisteredError(
          "an account with this email already exists",
        );
      }
      if (field === "username") {
        throw new UsernameAlreadyTakenError("that username is already taken");
      }
      throw error;
    }
    return this.issueSession(db, doc);
  }

  async signIn(input: SignInInput): Promise<IssuedSession> {
    const db = await this.db();
    const email = normalizeEmail(input.email);
    const user = await usersCollection(db).findOne({ email });
    // One generic failure for "no such account" and "wrong password" alike, so
    // the response never reveals whether an email is registered.
    if (user === null || !verifyPassword(input.password, user.passwordHash)) {
      throw new InvalidCredentialsError("email or password is incorrect");
    }
    return this.issueSession(db, user);
  }

  async userForToken(token: string): Promise<AuthenticatedUser> {
    const db = await this.db();
    const session = await this.activeSession(db, token);
    const user = await usersCollection(db).findOne({ _id: session.userId });
    if (user === null) {
      throw new InvalidSessionError("session is no longer valid");
    }
    return toAuthenticated(user);
  }

  async signOut(token: string): Promise<void> {
    const db = await this.db();
    // Idempotent: deleting an unknown or already-expired session still succeeds.
    await sessionsCollection(db).deleteOne({
      _id: digestSession(this.sessionHmacKey, token),
    });
  }

  /** Persist a fresh session for a user and return the raw token exactly once. */
  private async issueSession(
    db: Db,
    user: UserDocument,
  ): Promise<IssuedSession> {
    const token = this.newToken();
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    const session: SessionDocument = {
      _id: digestSession(this.sessionHmacKey, token),
      userId: user._id,
      createdAt: now,
      expiresAt,
    };
    await sessionsCollection(db).insertOne(session);
    return { accessToken: token, expiresAt, user: toAuthenticated(user) };
  }

  /** Resolve a live session by token, rejecting missing or expired ones. */
  private async activeSession(db: Db, token: string): Promise<SessionDocument> {
    const digest = digestSession(this.sessionHmacKey, token);
    const session = await sessionsCollection(db).findOne({ _id: digest });
    if (session === null) {
      throw new InvalidSessionError("session token is invalid");
    }
    // The TTL index reclaims expired rows lazily; reject them promptly here too.
    if (session.expiresAt.getTime() <= this.now().getTime()) {
      await sessionsCollection(db).deleteOne({ _id: digest });
      throw new InvalidSessionError("session has expired");
    }
    return session;
  }
}

function toAuthenticated(user: UserDocument): AuthenticatedUser {
  return { id: user._id, email: user.email, username: user.username };
}

/**
 * The unique field a duplicate-key error collided on, or null for anything else.
 * Sign-up uniqueness lives on `users.email` and `users.normalizedUsername`.
 */
function duplicateField(error: unknown): "email" | "username" | null {
  if (error instanceof MongoServerError && error.code === 11000) {
    const keys = Object.keys(error.keyPattern ?? {});
    if (keys.includes("email")) {
      return "email";
    }
    if (keys.includes("normalizedUsername")) {
      return "username";
    }
  }
  return null;
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
