/**
 * Keyed-digest and secret-generation helpers (port of the hashlib/hmac/secrets
 * usage in platform_app.modules.identity.service).
 *
 * Verification codes and session tokens are never stored in the clear — only
 * their HMAC-SHA256 digests are persisted.
 */
import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

/** HMAC-SHA256 hex digest binding a code to its challenge id. */
export function digestChallenge(
  key: string,
  challengeId: string,
  code: string,
): string {
  return createHmac("sha256", key).update(`${challengeId}:${code}`).digest("hex");
}

/** HMAC-SHA256 hex digest of an opaque session token. */
export function digestSession(key: string, token: string): string {
  return createHmac("sha256", key).update(token).digest("hex");
}

/** Constant-time comparison of two equal-length hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Six-digit, zero-padded numeric verification code. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** URL-safe opaque session token (32 random bytes). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
