/**
 * Passwordless identity HTTP API (port of identity.api).
 *
 * Routes (mounted under /api/v1):
 *   POST  /auth/challenges          -> 202 issue a verification code
 *   POST  /auth/challenges/verify   -> 200 verify and open a session
 *   PATCH /me/username              -> 200 change the public username
 */
import type {
  ChallengeResponse,
  SessionResponse,
  UsernameResponse,
} from "@energy/shared";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../http.js";
import type { UniversityVerificationGateway } from "../university/contracts.js";
import {
  ChallengeRateLimitError,
  InvalidChallengeError,
  InvalidSessionError,
  RosterIneligibleError,
  UniversityDomainError,
  UsernameUnavailableError,
} from "./errors.js";
import type { EmailCodeSender } from "./ports.js";
import { IdentityService } from "./service.js";

export interface IdentityRuntime {
  gateway: UniversityVerificationGateway;
  sender: EmailCodeSender;
  challengeHmacKey: string;
  sessionHmacKey: string;
  clock?: () => Date;
  codeFactory?: () => string;
  tokenFactory?: () => string;
}

const ChallengeRequestSchema = z
  .object({ email: z.string().min(3).max(320) })
  .strict();

const ChallengeVerificationSchema = z
  .object({
    challengeId: z.string().uuid(),
    code: z.string().regex(/^[0-9]{6}$/),
    username: z.string(),
  })
  .strict();

const UsernameChangeSchema = z.object({ username: z.string() }).strict();

export function createIdentityRouter(
  db: PrismaClient,
  runtime: IdentityRuntime,
): Router {
  const router = Router();
  const newService = (): IdentityService =>
    new IdentityService(
      db,
      runtime.gateway,
      runtime.sender,
      runtime.challengeHmacKey,
      runtime.sessionHmacKey,
      {
        clock: runtime.clock,
        codeFactory: runtime.codeFactory,
        tokenFactory: runtime.tokenFactory,
      },
    );

  router.post(
    "/auth/challenges",
    asyncHandler(async (req, res) => {
      const parsed = ChallengeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const issued = await newService().requestChallenge(parsed.data.email);
        const body: ChallengeResponse = {
          challengeId: issued.challengeId,
          expiresAt: issued.expiresAt.toISOString(),
          message: "A verification code has been sent to the eligible address.",
        };
        res.status(202).json(body);
      } catch (error) {
        if (error instanceof UniversityDomainError) {
          res.status(422).json({ error: error.message });
          return;
        }
        if (error instanceof ChallengeRateLimitError) {
          res.status(429).json({ error: error.message });
          return;
        }
        throw error;
      }
    }),
  );

  router.post(
    "/auth/challenges/verify",
    asyncHandler(async (req, res) => {
      const parsed = ChallengeVerificationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const activated = await newService().verifyChallenge(
          parsed.data.challengeId,
          parsed.data.code,
          parsed.data.username,
        );
        const body: SessionResponse = {
          accessToken: activated.accessToken,
          tokenType: "bearer",
          expiresAt: activated.expiresAt.toISOString(),
          username: activated.username,
          roles: activated.roles,
        };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof InvalidChallengeError) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error instanceof RosterIneligibleError) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error instanceof UsernameUnavailableError) {
          res.status(409).json({ error: error.message });
          return;
        }
        throw error;
      }
    }),
  );

  router.patch(
    "/me/username",
    asyncHandler(async (req, res) => {
      const authorization = req.header("authorization");
      if (authorization === undefined || !authorization.startsWith("Bearer ")) {
        res.status(401).json({ error: "access token is required" });
        return;
      }
      const parsed = UsernameChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const service = newService();
        const principal = await service.principalForToken(
          authorization.slice("Bearer ".length),
        );
        const username = await service.changeUsername(
          principal,
          parsed.data.username,
        );
        const body: UsernameResponse = { username };
        res.status(200).json(body);
      } catch (error) {
        if (error instanceof InvalidSessionError) {
          res.status(401).json({ error: error.message });
          return;
        }
        if (error instanceof UsernameUnavailableError) {
          res.status(409).json({ error: error.message });
          return;
        }
        throw error;
      }
    }),
  );

  return router;
}

function issue(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? `${first.path.join(".") || "body"}: ${first.message}` : "invalid";
}
