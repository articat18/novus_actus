/**
 * Environment-backed configuration (port of platform_app.settings).
 *
 * Validated with zod: secrets must be present and HMAC keys at least 32 chars,
 * mirroring the original Pydantic settings' fail-fast behaviour at startup.
 */
import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const ConfigSchema = z.object({
  databaseUrl: z.string().min(1, "DATABASE_URL is required"),
  challengeHmacKey: z
    .string()
    .min(32, "CHALLENGE_HMAC_KEY must be at least 32 characters"),
  sessionHmacKey: z
    .string()
    .min(32, "SESSION_HMAC_KEY must be at least 32 characters"),
  universityGateway: z.enum(["roster", "http"]).default("roster"),
  universityApiUrl: z.string().url().default("http://localhost:3001"),
  enableDevInbox: boolFromEnv.default("false"),
  port: z.coerce.number().int().positive().default(3001),
  serviceName: z.string().default("Energy Leaderboard Platform"),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(
      "Invalid configuration:\n" +
        issues
          .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("\n"),
    );
    this.name = "ConfigError";
  }
}

/**
 * Parse configuration from a raw environment map (defaults to process.env).
 * Throws {@link ConfigError} listing every problem when validation fails.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = ConfigSchema.safeParse({
    databaseUrl: env.DATABASE_URL,
    challengeHmacKey: env.CHALLENGE_HMAC_KEY,
    sessionHmacKey: env.SESSION_HMAC_KEY,
    universityGateway: env.UNIVERSITY_GATEWAY,
    universityApiUrl: env.UNIVERSITY_API_URL,
    enableDevInbox: env.ENABLE_DEV_INBOX,
    port: env.PORT,
    serviceName: env.SERVICE_NAME,
  });
  if (!result.success) {
    throw new ConfigError(result.error.issues);
  }
  return result.data;
}
