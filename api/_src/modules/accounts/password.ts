/**
 * Password hashing.
 *
 * Uses scrypt from `node:crypto` rather than argon2/bcrypt so there is no
 * native dependency to build for the Vercel serverless runtime. scrypt is a
 * memory-hard KDF and an acceptable choice; the parameters and salt are stored
 * alongside the digest so they can be raised later without invalidating
 * existing hashes.
 *
 * Stored form: `scrypt$<N>$<r>$<p>$<salt-base64>$<key-base64>`
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Current cost parameters. Raising these is safe: old hashes keep their own. */
const CURRENT = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** scrypt needs maxmem > 128 * N * r; 2**15 * 8 * 128 is exactly 32 MiB. */
const MAX_MEMORY = 96 * 1024 * 1024;

interface Params {
  N: number;
  r: number;
  p: number;
}

function derive(password: string, salt: Buffer, params: Params): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      // Normalize so visually identical passwords entered on different
      // platforms produce the same key.
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEMORY },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(key);
      },
    );
  });
}

/** Hash a password with the current parameters and a fresh random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, CURRENT);
  return [
    "scrypt",
    CURRENT.N,
    CURRENT.r,
    CURRENT.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Verify a password against a stored hash. Returns false — never throws — for
 * a malformed or unknown-algorithm hash, so a corrupt row denies access
 * instead of producing a 500.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const params = { N: Number(rawN), r: Number(rawR), p: Number(rawP) };
  if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) {
    return false;
  }
  const expected = Buffer.from(rawKey, "base64");
  if (expected.length !== KEY_LENGTH) {
    return false;
  }
  let actual: Buffer;
  try {
    actual = await derive(password, Buffer.from(rawSalt, "base64"), params);
  } catch {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

/** True when a stored hash was produced with weaker parameters than current. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return true;
  }
  return (
    Number(parts[1]) < CURRENT.N ||
    Number(parts[2]) < CURRENT.r ||
    Number(parts[3]) < CURRENT.p
  );
}
