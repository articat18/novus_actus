/**
 * Platform Express application factory.
 *
 * Assembles configuration and the HTTP routers into one app. The data layer is
 * MongoDB (see `db.ts`); readiness pings it. Dependencies are injectable so tests
 * can supply a fixed clock and a deterministic token factory.
 */
import express, { type Express } from "express";

import { loadConfig, type Config } from "./config.js";
import { pingDatabase } from "./db.js";
import { errorHandler } from "./http.js";
import { createAuthRouter } from "./modules/identity/router.js";
import { createVerificationRouter } from "./modules/university/router.js";

export interface CreateAppOptions {
  config?: Config;
  clock?: () => Date;
  tokenFactory?: () => string;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const config = options.config ?? loadConfig();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: config.serviceName,
      time: new Date().toISOString(),
    });
  });

  app.get("/api/health/ready", async (_req, res) => {
    const ready = await pingDatabase();
    res.status(ready ? 200 : 503).json({ ready });
  });

  app.use(
    "/api/v1",
    createAuthRouter({
      sessionHmacKey: config.sessionHmacKey,
      clock: options.clock,
      tokenFactory: options.tokenFactory,
    }),
  );
  // Read-only university roster verification (stubbed pending the MongoDB schema).
  app.use("/api/v1/verification", createVerificationRouter());

  app.use(errorHandler());
  return app;
}
