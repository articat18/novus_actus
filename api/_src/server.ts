/**
 * Local development entry point. Runs the Express app as a long-lived Node
 * server. On Vercel this file is unused; api/index.ts is the serverless entry.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { getDb } from "./db.js";
import { ensureIndexes } from "./persistence/index.js";

// Load the monorepo-root .env regardless of the working directory. The
// `npm run dev -w @energy/api` script runs with cwd set to api/, where there is
// no .env, so a plain `dotenv/config` (which only reads cwd) would find nothing.
// None of the imports above read environment variables at load time, so doing
// this before loadConfig() is sufficient.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadDotenv({ path: resolve(projectRoot, ".env") });

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `${config.serviceName} API listening on http://localhost:${config.port}`,
  );
});

// Ensure collection indexes (unique email/username, one room per user, session
// TTL) in the BACKGROUND. This must never block `app.listen` above — connecting
// to a remote database can take seconds, and the HTTP port has to open right
// away or the Vite proxy sees ECONNREFUSED. A failure here is logged, not fatal;
// the next boot retries.
void getDb()
  .then((db) => ensureIndexes(db))
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("[api] collection indexes ensured");
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn(`[api] could not ensure indexes: ${message}`);
  });
