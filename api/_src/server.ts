/**
 * Local development entry point. Runs the Express app as a long-lived Node
 * server. On Vercel this file is unused; api/index.ts is the serverless entry.
 */
import "dotenv/config";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `${config.serviceName} API listening on http://localhost:${config.port}`,
  );
});
