import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../server/app";
import { seedSampleData } from "../server/seed";

const database = await MongoMemoryServer.create();
process.env.MONGODB_URI = database.getUri("novus_actus_browser_test");
process.env.JWT_SECRET = "browser-test-secret-not-used-in-production";

await seedSampleData();

const server = app.listen(3101, "127.0.0.1", () => {
  console.log("Browser-test API ready at http://127.0.0.1:3101");
});

async function shutdown() {
  server.close();
  await database.stop();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
