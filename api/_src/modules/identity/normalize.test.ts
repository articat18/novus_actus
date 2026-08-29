/**
 * Email normalization rules for authentication.
 */
import { describe, expect, it } from "vitest";

import { InvalidCredentialsError } from "./errors.js";
import { normalizeEmail } from "./service.js";

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => {
    expect(normalizeEmail("  Student@Demo.Edu ")).toBe("student@demo.edu");
  });

  it("splits on the final @", () => {
    expect(normalizeEmail("a@b@demo.edu")).toBe("a@b@demo.edu");
  });

  it.each(["", "nolocal@", "@nodomain", "plainstring"])(
    "rejects the malformed address %j",
    (email) => {
      expect(() => normalizeEmail(email)).toThrow(InvalidCredentialsError);
    },
  );
});
