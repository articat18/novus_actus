/** Organization name normalization and slug derivation. */
import { describe, expect, it } from "vitest";

import { InvalidOrganizationError } from "./errors.js";
import { normalizeOrganizationName, slugify } from "./normalize.js";

describe("normalizeOrganizationName", () => {
  it("collapses surrounding and interior whitespace", () => {
    expect(normalizeOrganizationName("  The   Tan\tFamily ")).toBe(
      "The Tan Family",
    );
  });

  it.each(["", "   ", "x".repeat(121)])("rejects %p", (name) => {
    expect(() => normalizeOrganizationName(name)).toThrow(
      InvalidOrganizationError,
    );
  });
});

describe("slugify", () => {
  it.each([
    ["The Tan Family", "the-tan-family"],
    ["Acme, Inc.", "acme-inc"],
    ["Café Ünïcode", "cafe-unicode"],
    ["  --Leading and trailing--  ", "leading-and-trailing"],
    ["multiple     spaces", "multiple-spaces"],
  ])("turns %p into %p", (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });

  it("falls back to a stable slug when nothing survives", () => {
    expect(slugify("🎉🎉🎉")).toBe("org");
  });

  it("bounds the slug length", () => {
    expect(slugify("a".repeat(200))).toHaveLength(100);
  });
});
