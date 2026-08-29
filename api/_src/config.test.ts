/**
 * Configuration validation (port of the settings tests in test_foundation.py).
 */
import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "./config.js";

const VALID = {
  DATABASE_URL: "postgresql://example/platform",
  CHALLENGE_HMAC_KEY: "challenge-key-that-is-at-least-32-bytes",
  SESSION_HMAC_KEY: "session-key-that-is-at-least-32-bytes-long",
} satisfies NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("builds a config from valid environment values", () => {
    const config = loadConfig(VALID);
    expect(config.serviceName).toBe("Energy Leaderboard Platform");
    expect(config.universityGateway).toBe("roster");
    expect(config.enableDevInbox).toBe(false);
    expect(config.port).toBe(3001);
  });

  it("rejects missing required settings and lists each one", () => {
    let caught: ConfigError | undefined;
    try {
      loadConfig({});
    } catch (error) {
      caught = error as ConfigError;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const missing = new Set(caught?.issues.map((i) => i.path.join(".")));
    expect(missing).toEqual(
      new Set(["databaseUrl", "challengeHmacKey", "sessionHmacKey"]),
    );
  });

  it("rejects HMAC keys shorter than 32 characters", () => {
    expect(() =>
      loadConfig({ ...VALID, SESSION_HMAC_KEY: "too-short" }),
    ).toThrow(ConfigError);
  });
});
