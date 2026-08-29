/**
 * Password hashing and session-token digests (pure, no database).
 */
import { describe, expect, it } from "vitest";

import {
  digestSession,
  generateToken,
  hashPassword,
  verifyPassword,
} from "./crypto.js";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("uses a distinct salt per hash", () => {
    expect(hashPassword("same-password")).not.toBe(hashPassword("same-password"));
  });

  it("rejects a malformed stored digest", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "plain")).toBe(false);
    expect(verifyPassword("x", "bcrypt$aa$bb")).toBe(false);
  });
});

describe("session-token digests", () => {
  it("is stable for a key/token pair and never contains the token", () => {
    const token = generateToken();
    const key = "session-key-that-is-at-least-32-bytes-long";
    const digest = digestSession(key, token);
    expect(digest).toBe(digestSession(key, token));
    expect(digest).not.toContain(token);
    expect(digest).toHaveLength(64);
  });
});
