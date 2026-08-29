import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { seedSampleData } from "../seed";
import { User } from "../models/User";

let database: MongoMemoryServer;
const originalMongoUri = process.env.MONGODB_URI;
const originalDatabaseName = process.env.MONGODB_DB_NAME;

beforeAll(async () => {
  database = await MongoMemoryServer.create();
});

afterEach(async () => {
  await mongoose.disconnect();
  globalThis.novusMongooseConnection = undefined;
});

afterAll(async () => {
  if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = originalMongoUri;

  if (originalDatabaseName === undefined) delete process.env.MONGODB_DB_NAME;
  else process.env.MONGODB_DB_NAME = originalDatabaseName;

  await database.stop();
});

it("seeds into a dedicated database when the URI has no database name", async () => {
  const legacyClient = new mongoose.mongo.MongoClient(database.getUri("test"));
  await legacyClient.connect();
  const legacyUsers = legacyClient.db("test").collection("users");
  await legacyUsers.createIndex(
    { normalizedUsername: 1 },
    { unique: true, name: "uq_users_username" },
  );
  await legacyUsers.insertOne({ normalizedUsername: null, source: "another-application" });
  await legacyClient.close();

  process.env.MONGODB_URI = database.getUri();
  delete process.env.MONGODB_DB_NAME;

  await seedSampleData();

  expect(mongoose.connection.name).toBe("novus_actus");
  expect(await User.countDocuments()).toBe(8);
});
