/**
 * Input validation and document factories.
 */
import { describe, expect, it } from "vitest";

import { verifyPassword } from "../crypto.js";
import {
  CreateRoomInput,
  CreateUserInput,
  newRoomDocument,
  newUserDocument,
  normalizeUsername,
} from "./schemas.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("normalizeUsername", () => {
  it("trims and lower-cases", () => {
    expect(normalizeUsername("  Ada_Lovelace ")).toBe("ada_lovelace");
  });
});

describe("newUserDocument", () => {
  it("generates a UUID _id, normalizes, and hashes the password", () => {
    const now = new Date("2026-08-29T00:00:00.000Z");
    const doc = newUserDocument(
      { username: "  Ada ", email: "ADA@Example.COM ", password: "hunter2secret" },
      now,
    );

    expect(doc._id).toMatch(UUID_RE);
    expect(doc.username).toBe("Ada"); // display case preserved
    expect(doc.normalizedUsername).toBe("ada");
    expect(doc.email).toBe("ada@example.com"); // normalized login identifier
    expect(doc.passwordHash).not.toContain("hunter2secret");
    expect(verifyPassword("hunter2secret", doc.passwordHash)).toBe(true);
    expect(doc.createdAt).toEqual(now);
    expect(doc.updatedAt).toEqual(now);
  });
});

describe("CreateUserInput", () => {
  it("rejects short passwords and bad emails", () => {
    expect(
      CreateUserInput.safeParse({ username: "a", email: "nope", password: "x" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    expect(
      CreateUserInput.safeParse({
        username: "ada",
        email: "ada@example.com",
        password: "longenough",
        admin: true,
      }).success,
    ).toBe(false);
  });
});

describe("newRoomDocument", () => {
  it("defaults energy to zero when omitted", () => {
    const parsed = CreateRoomInput.parse({
      name: "Bedroom",
      householdId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
    });
    const doc = newRoomDocument(parsed);

    expect(doc.energyKwh).toBe(0);
    expect(doc._id).toMatch(UUID_RE);
  });
});
