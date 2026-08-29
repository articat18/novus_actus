/**
 * Environment-backed configuration.
 *
 * Validated with zod: the database URL must be present and the session HMAC key
 * at least 32 characters, failing fast at startup when misconfigured.
 */
import { z } from "zod";

const ConfigSchema = z.object({
  databaseUrl: z.string().min(1, "DATABASE_URL is required"),
  sessionHmacKey: z
    .string()
    .min(32, "SESSION_HMAC_KEY must be at least 32 characters"),
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
    sessionHmacKey: env.SESSION_HMAC_KEY,
    port: env.PORT,
    serviceName: env.SERVICE_NAME,
  });
  if (!result.success) {
    throw new ConfigError(result.error.issues);
  }
  return result.data;
}
