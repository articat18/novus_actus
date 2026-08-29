import { defineConfig } from "vitest/config";

// Unit tests run everywhere. Integration tests (files under **/integration/**)
// self-skip when TEST_DATABASE_URL is not set — see api/_src/test/db.ts.
export default defineConfig({
  test: {
    include: ["api/**/*.test.ts"],
    environment: "node",
    globals: false,
    passWithNoTests: false,
  },
});
