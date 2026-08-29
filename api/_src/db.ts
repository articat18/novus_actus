/**
 * MongoDB connection (official `mongodb` driver).
 *
 * A single MongoClient is created lazily and reused across warm serverless
 * invocations (important on Vercel — a new connection per request would exhaust
 * the pool). The connection string comes from `MONGODB_URI`; the database used is
 * the one embedded in that URI.
 *
 * Collection shapes, indexes, and validation live in `./persistence` (see
 * `persistence/collections.ts` and `persistence/schemas.ts`); this module only
 * establishes the connection.
 */
import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (uri === undefined || uri.trim() === "") {
    throw new Error("MONGODB_URI is not set");
  }
  return uri;
}

/** Connect once and reuse the client (and its pool) across invocations. */
export function getMongoClient(): Promise<MongoClient> {
  if (globalForMongo._mongoClientPromise === undefined) {
    // Fail fast when the database is unreachable (e.g. this machine's IP isn't on
    // the Atlas allow-list) so requests return a clear error in a few seconds
    // instead of hanging on the driver's 30s default.
    const client = new MongoClient(mongoUri(), {
      serverSelectionTimeoutMS: 8000,
    });
    globalForMongo._mongoClientPromise = client.connect().catch((error: unknown) => {
      // Don't cache a failed connection — let the next call retry with a fresh client.
      globalForMongo._mongoClientPromise = undefined;
      throw error;
    });
  }
  return globalForMongo._mongoClientPromise;
}

/** The default database named in the connection string. */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db();
}

/** Liveness check for the readiness endpoint. */
export async function pingDatabase(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

/** Close the client and reset the cached connection (tests / shutdown). */
export async function disconnectMongo(): Promise<void> {
  const pending = globalForMongo._mongoClientPromise;
  if (pending !== undefined) {
    globalForMongo._mongoClientPromise = undefined;
    const client = await pending;
    await client.close();
  }
}
