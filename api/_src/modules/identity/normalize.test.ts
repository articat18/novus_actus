/**
 * Email and username normalization rules (port of the module-level helpers).
 */
import { describe, expect, it } from "vitest";

import { UniversityDomainError, UsernameUnavailableError } from "./errors.js";
import { normalizeEmail, normalizeUsername } from "./service.js";

describe("normalizeEmail", () => {
  it("lower-cases and trims, returning the domain", () => {
    expect(normalizeEmail("  Student@Demo.Edu ")).toEqual(["student@demo.edu", "demo.edu"]);
  });

  it("splits on the final @", () => {
    expect(normalizeEmail("a@b@demo.edu")).toEqual(["a@b@demo.edu", "demo.edu"]);
  });

  it.each(["", "nolocal@", "@nodomain", "plainstring"])(
    "rejects the malformed address %j",
    (email) => {
      expect(() => normalizeEmail(email)).toThrow(UniversityDomainError);
    },
  );
});

describe("normalizeUsername", () => {
  it("lower-cases a valid username", () => {
    expect(normalizeUsername("EcoHero")).toBe("ecohero");
  });

  it.each(["ab", "this_username_is_way_too_long_x", "has space", "bad!", ""])(
    "rejects the invalid username %j",
    (username) => {
      expect(() => normalizeUsername(username)).toThrow(UsernameUnavailableError);
    },
  );
});
