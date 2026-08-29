/**
 * Configuration validation.
 */
import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "./config.js";

const VALID = {
  MONGODB_URI: "mongodb://localhost:27017/energy",
  SESSION_HMAC_KEY: "session-key-that-is-at-least-32-bytes-long",
} satisfies NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("builds a config from valid environment values", () => {
    const config = loadConfig(VALID);
    expect(config.serviceName).toBe("Energy Leaderboard Platform");
    expect(config.port).toBe(3001);
    expect(config.mongodbUri).toBe("mongodb://localhost:27017/energy");
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
    expect(missing).toEqual(new Set(["mongodbUri", "sessionHmacKey"]));
  });

  it("rejects an HMAC key shorter than 32 characters", () => {
    expect(() =>
      loadConfig({ ...VALID, SESSION_HMAC_KEY: "too-short" }),
    ).toThrow(ConfigError);
  });
});
