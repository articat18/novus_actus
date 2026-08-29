/**
 * Session-token digests and password hashing (node:crypto only — no native
 * dependencies, so it runs unchanged on Vercel's serverless runtime).
 *
 * Session tokens are never stored in the clear — only their HMAC-SHA256 digest
 * is persisted. Passwords are stored as salted scrypt digests.
 */
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/** HMAC-SHA256 hex digest of an opaque session token. */
export function digestSession(key: string, token: string): string {
  return createHmac("sha256", key).update(token).digest("hex");
}

/** URL-safe opaque session token (32 random bytes). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// scrypt parameters. keylen 64 with the Node defaults (N=16384, r=8, p=1) stays
// under the default 32 MiB maxmem, so no tuning is required.
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * Hash a password as `scrypt$<saltHex>$<hashHex>`. The format is self-describing
 * so {@link verifyPassword} needs no external parameters, and it is a plain
 * string — portable to any store (including the planned MongoDB Atlas move).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verification of a password against a stored scrypt digest. */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || saltHex === undefined || hashHex === undefined) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) {
    return false;
  }
  const derived = scryptSync(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
