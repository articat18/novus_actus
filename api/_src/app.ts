/**
 * Platform Express application factory.
 *
 * Assembles configuration, the database client, and the HTTP routers into one
 * app. Dependencies are injectable so tests can supply a fixed clock and a
 * deterministic token factory.
 */
import type { PrismaClient } from "@prisma/client";
import express, { type Express } from "express";

import { loadConfig, type Config } from "./config.js";
import { prisma } from "./db.js";
import { errorHandler } from "./http.js";
import { createAuthRouter } from "./modules/identity/router.js";
import { createVerificationRouter } from "./modules/university/router.js";

export interface CreateAppOptions {
  config?: Config;
  db?: PrismaClient;
  clock?: () => Date;
  tokenFactory?: () => string;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const config = options.config ?? loadConfig();
  const db = options.db ?? prisma;

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
    try {
      await db.$runCommandRaw({ ping: 1 });
      res.json({ ready: true });
    } catch {
      res.status(503).json({ ready: false });
    }
  });

  app.use(
    "/api/v1",
    createAuthRouter(db, {
      sessionHmacKey: config.sessionHmacKey,
      clock: options.clock,
      tokenFactory: options.tokenFactory,
    }),
  );
  // Read-only university roster verification (kept from the original platform).
  app.use("/api/v1/verification", createVerificationRouter(db));

  app.use(errorHandler());
  return app;
}
