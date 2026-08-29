import dotenv from "dotenv";
import path from "node:path";

let loaded = false;

function loadLocalEnvironment() {
  if (loaded || process.env.NODE_ENV === "production") {
    return;
  }

  // The project-level .env remains the single local source of MongoDB credentials.
  dotenv.config({ path: path.resolve(process.cwd(), "../.env"), quiet: true });
  loaded = true;
}

export function getMongoUri() {
  loadLocalEnvironment();
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Add it to ../.env locally or to the Vercel environment variables.",
    );
  }

  return uri;
}

export function getMongoDatabaseName() {
  loadLocalEnvironment();
  const configuredName = process.env.MONGODB_DB_NAME?.trim();
  return configuredName || "novus_actus";
}

export function getJwtSecret() {
  loadLocalEnvironment();

  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in the Vercel environment variables.");
  }

  return "novus-actus-local-development-secret-change-before-production";
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
