import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { connectToDatabase } from "./config/database";
import { Household } from "./models/Household";
import { Room } from "./models/Room";
import { User } from "./models/User";

const householdProfiles = [
  { name: "Verdant House", basePerPax: 4.35, rooms: [{ name: "Fern Room", pax: 2 }, { name: "Canopy Room", pax: 3 }] },
  { name: "Willow Collective", basePerPax: 4.92, rooms: [{ name: "Brook Room", pax: 1 }, { name: "Grove Room", pax: 3 }] },
  { name: "Cedar Court", basePerPax: 5.48, rooms: [{ name: "Cedar Room", pax: 2 }, { name: "Briar Room", pax: 2 }] },
  { name: "Sage Commons", basePerPax: 6.04, rooms: [{ name: "Sage Room", pax: 3 }, { name: "Thyme Room", pax: 2 }] },
  { name: "Meadow Residence", basePerPax: 6.61, rooms: [{ name: "Clover Room", pax: 2 }, { name: "Daisy Room", pax: 4 }] },
] as const;

const sampleNames = [
  "Avery Tan",
  "Jordan Lim",
  "Morgan Lee",
  "Riley Wong",
  "Casey Goh",
  "Taylor Ong",
  "Jamie Koh",
  "Drew Ng",
];

export async function seedSampleData() {
  await connectToDatabase();
  const password = await bcrypt.hash("demo1234", 10);

  const userIds = sampleNames.map((_, index) => fixedId("1", index + 1));
  await Promise.all(
    sampleNames.map((name, index) =>
      User.findByIdAndUpdate(
        userIds[index],
        {
          name,
          email: `resident${index + 1}@novus.demo`,
          password,
        },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  for (let householdIndex = 0; householdIndex < householdProfiles.length; householdIndex += 1) {
    const profile = householdProfiles[householdIndex];
    const roomIds: mongoose.Types.ObjectId[] = [];

    for (let roomIndex = 0; roomIndex < profile.rooms.length; roomIndex += 1) {
      const roomId = fixedId("2", householdIndex * 2 + roomIndex + 1);
      const userId = userIds[(householdIndex * 2 + roomIndex) % userIds.length];
      const roomProfile = profile.rooms[roomIndex];
      const pax = roomProfile.pax;
      roomIds.push(roomId);

      await Room.findByIdAndUpdate(
        roomId,
        {
          name: roomProfile.name,
          user: userId,
          pax,
          usage: makeUsageReadings(profile.basePerPax, pax, householdIndex, roomIndex),
        },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
    }

    await Household.findByIdAndUpdate(
      fixedId("3", householdIndex + 1),
      { name: profile.name, rooms: roomIds },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  console.log("Sample data is ready.");
  console.log("Demo account: resident1@novus.demo / demo1234");
}

function fixedId(prefix: string, value: number) {
  return new mongoose.Types.ObjectId(`${prefix}${value.toString(16).padStart(23, "0")}`);
}

function makeUsageReadings(
  basePerPax: number,
  pax: number,
  householdIndex: number,
  roomIndex: number,
) {
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Array.from({ length: 400 }, (_, dayOffset) => {
    const recordedAt = new Date(utcToday - dayOffset * 24 * 60 * 60 * 1000);
    const seasonal = 1 + Math.sin((dayOffset / 365) * Math.PI * 2) * 0.08;
    const weekly = 1 + ((dayOffset + householdIndex) % 7) * 0.012;
    const roomFactor = roomIndex === 0 ? 0.97 : 1.03;
    const kwh = basePerPax * pax * seasonal * weekly * roomFactor;

    return { kwh: Math.round(kwh * 100) / 100, recordedAt };
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedSampleData()
    .catch((error) => {
      console.error("Could not seed sample data:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
