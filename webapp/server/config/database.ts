import mongoose from "mongoose";
import { getMongoDatabaseName, getMongoUri } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var novusMongooseConnection: Promise<typeof mongoose> | undefined;
}

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!globalThis.novusMongooseConnection) {
    globalThis.novusMongooseConnection = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
      dbName: getMongoDatabaseName(),
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    return await globalThis.novusMongooseConnection;
  } catch (error) {
    globalThis.novusMongooseConnection = undefined;
    throw error;
  }
}
