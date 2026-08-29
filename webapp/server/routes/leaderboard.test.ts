import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RoomLeaderboardResponse } from "../../shared/types";
import app from "../app";
import { Household } from "../models/Household";
import { seedSampleData } from "../seed";

describe("room leaderboard access", () => {
  let database: MongoMemoryServer;
  let server: Server;
  let baseUrl: string;
  let sessionCookie: string;
  const originalMongoUri = process.env.MONGODB_URI;
  const originalDatabaseName = process.env.MONGODB_DB_NAME;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    database = await MongoMemoryServer.create();
    process.env.MONGODB_URI = database.getUri();
    process.env.MONGODB_DB_NAME = "novus_room_route_test";
    process.env.JWT_SECRET = "room-route-test-secret";

    await seedSampleData();
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "resident1@novus.demo",
        password: "demo1234",
      }),
    });

    expect(signInResponse.status).toBe(200);
    sessionCookie = signInResponse.headers.get("set-cookie")?.split(";")[0] || "";
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    globalThis.novusMongooseConnection = undefined;
    await database.stop();

    restoreEnvironment("MONGODB_URI", originalMongoUri);
    restoreEnvironment("MONGODB_DB_NAME", originalDatabaseName);
    restoreEnvironment("JWT_SECRET", originalJwtSecret);
  });

  it("returns only the signed-in user's households and room-safe fields", async () => {
    const response = await fetch(`${baseUrl}/api/leaderboard/rooms?period=monthly`, {
      headers: { Cookie: sessionCookie },
    });
    const payload = (await response.json()) as RoomLeaderboardResponse;

    expect(response.status).toBe(200);
    expect(payload.households.map((household) => household.name)).toEqual([
      "Meadow Residence",
      "Verdant House",
    ]);
    expect(payload.household?.name).toBe("Meadow Residence");
    expect(payload.entries.map((entry) => entry.roomName).sort()).toEqual([
      "Clover Room",
      "Daisy Room",
    ]);
    expect(Object.keys(payload.entries[0]).sort()).toEqual([
      "kwhPerPax",
      "pax",
      "rank",
      "roomId",
      "roomName",
      "totalKwh",
    ]);
  });

  it("does not reveal a household the signed-in user is not registered under", async () => {
    const inaccessibleHousehold = await Household.findOne({ name: "Cedar Court" }).lean();
    const response = await fetch(
      `${baseUrl}/api/leaderboard/rooms?householdId=${inaccessibleHousehold?._id.toString()}`,
      { headers: { Cookie: sessionCookie } },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Household not found." });
  });
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
