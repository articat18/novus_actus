/**
 * Platform Express application factory (port of platform_app.application).
 *
 * Assembles configuration, the database client, the university gateway, and the
 * HTTP routers into one app. Dependencies are injectable so tests can supply a
 * fake gateway, a fixed clock, and deterministic code/token factories.
 */
import express, { type Express } from "express";

import { loadConfig, type Config } from "./config.js";
import { prisma } from "./db.js";
import { createDevInboxRouter } from "./dev.js";
import { errorHandler } from "./http.js";
import { createIdentityRouter } from "./modules/identity/router.js";
import {
  InMemoryEmailCodeSender,
  type EmailCodeSender,
} from "./modules/identity/ports.js";
import type { UniversityVerificationGateway } from "./modules/university/contracts.js";
import { HttpUniversityGateway } from "./modules/university/http-gateway.js";
import { InProcessUniversityGateway } from "./modules/university/roster-gateway.js";
import { createVerificationRouter } from "./modules/university/router.js";
import type { PrismaClient } from "@prisma/client";

export interface CreateAppOptions {
  config?: Config;
  db?: PrismaClient;
  gateway?: UniversityVerificationGateway;
  sender?: EmailCodeSender;
  clock?: () => Date;
  codeFactory?: () => string;
  tokenFactory?: () => string;
  /** Override the config's dev-inbox flag (mainly for tests). */
  enableDevInbox?: boolean;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const config = options.config ?? loadConfig();
  const db = options.db ?? prisma;
  const sender = options.sender ?? new InMemoryEmailCodeSender();
  const gateway =
    options.gateway ??
    (config.universityGateway === "http"
      ? new HttpUniversityGateway(config.universityApiUrl)
      : new InProcessUniversityGateway(db));

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
      await db.$queryRaw`SELECT 1`;
      res.json({ ready: true });
    } catch {
      res.status(503).json({ ready: false });
    }
  });

  app.use(
    "/api/v1",
    createIdentityRouter(db, {
      gateway,
      sender,
      challengeHmacKey: config.challengeHmacKey,
      sessionHmacKey: config.sessionHmacKey,
      clock: options.clock,
      codeFactory: options.codeFactory,
      tokenFactory: options.tokenFactory,
    }),
  );
  app.use("/api/v1/verification", createVerificationRouter(db));

  const devInboxEnabled = options.enableDevInbox ?? config.enableDevInbox;
  if (devInboxEnabled && sender instanceof InMemoryEmailCodeSender) {
    app.use("/api/v1/dev", createDevInboxRouter(sender));
  }

  app.use(errorHandler());
  return app;
}
