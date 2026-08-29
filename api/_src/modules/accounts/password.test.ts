/** scrypt password hashing: format, verification, and failure behaviour. */
import { describe, expect, it } from "vitest";

import { hashPassword, needsRehash, verifyPassword } from "./password.js";

describe("hashPassword", () => {
  it("produces a self-describing scrypt string", async () => {
    const stored = await hashPassword("correct horse battery");
    const parts = stored.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(2 ** 15);
    expect(parts).toHaveLength(6);
    // 32 raw bytes, base64.
    expect(Buffer.from(parts[5]!, "base64")).toHaveLength(32);
  });

  it("salts every hash so equal passwords differ on disk", async () => {
    const [first, second] = await Promise.all([
      hashPassword("correct horse battery"),
      hashPassword("correct horse battery"),
    ]);
    expect(first).not.toBe(second);
    expect(first).not.toContain("correct horse battery");
  });
});

describe("verifyPassword", () => {
  it("accepts the original password and rejects a near miss", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("treats canonically equivalent unicode as the same password", async () => {
    // U+00E9 vs. e + U+0301 — identical once NFKC-normalized.
    const stored = await hashPassword("café-passphrase");
    expect(await verifyPassword("café-passphrase", stored)).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["not-a-hash", "unstructured"],
    ["bcrypt$1$2$3$4$5", "another algorithm"],
    ["scrypt$x$8$1$c2FsdA==$a2V5", "non-numeric cost"],
    ["scrypt$32768$8$1$c2FsdA==$dG9vLXNob3J0", "truncated key"],
  ])("returns false for a %s stored hash (%s)", async (stored) => {
    await expect(verifyPassword("anything", stored)).resolves.toBe(false);
  });
});

describe("needsRehash", () => {
  it("flags weaker or unreadable hashes and passes current ones", async () => {
    expect(needsRehash(await hashPassword("correct horse battery"))).toBe(false);
    expect(needsRehash("scrypt$16384$8$1$c2FsdA==$a2V5")).toBe(true);
    expect(needsRehash("garbage")).toBe(true);
  });
});
