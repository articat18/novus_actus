/**
 * Passwordless identity HTTP API (port of identity.api).
 *
 * Routes (mounted under /api/v1):
 *   POST  /auth/challenges          -> 202 issue a verification code
 *   POST  /auth/challenges/verify   -> 200 verify and open a session
 *   GET   /me/profile               -> 200 read the caller's own profile
 *   PATCH /me/username              -> 200 change the public username
 */
import type {
  ChallengeResponse,
  ProfileResponse,
  SessionResponse,
  UsernameResponse,
} from "@energy/shared";
import type { PrismaClient } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";

import { asyncHandler, bearerToken } from "../../http.js";
import type { UniversityVerificationGateway } from "../university/contracts.js";
import { AccessDeniedError } from "./authorization.js";
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
import { ProfileNotFoundError, TenantAccessDeniedError } from "./tenant.js";

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
        rethrowUnlessMapped(res, error);
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
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.get(
    "/me/profile",
    asyncHandler(async (req, res) => {
      const token = bearerToken(req);
      if (token === null) {
        res.status(401).json({ error: "access token is required" });
        return;
      }
      try {
        const service = newService();
        const principal = await service.principalForToken(token);
        const profile = await service.ownProfile(principal);
        const body: ProfileResponse = {
          profileId: profile.id,
          username: profile.username,
          createdAt: profile.createdAt.toISOString(),
        };
        res.status(200).json(body);
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.patch(
    "/me/username",
    asyncHandler(async (req, res) => {
      const token = bearerToken(req);
      if (token === null) {
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
        const principal = await service.principalForToken(token);
        const username = await service.changeUsername(
          principal,
          parsed.data.username,
        );
        const body: UsernameResponse = { username };
        res.status(200).json(body);
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  return router;
}

/**
 * Status for each error the identity surface is allowed to surface. Anything
 * absent is a genuine fault and must reach the terminal error handler as a 500.
 */
export function mappedStatus(error: unknown): number | null {
  if (error instanceof InvalidChallengeError) {
    return 400;
  }
  if (error instanceof InvalidSessionError) {
    return 401;
  }
  if (
    error instanceof AccessDeniedError ||
    error instanceof TenantAccessDeniedError ||
    error instanceof RosterIneligibleError
  ) {
    return 403;
  }
  if (error instanceof ProfileNotFoundError) {
    return 404;
  }
  if (error instanceof UsernameUnavailableError) {
    return 409;
  }
  if (error instanceof UniversityDomainError) {
    return 422;
  }
  if (error instanceof ChallengeRateLimitError) {
    return 429;
  }
  return null;
}

/** Send a mapped error response, or rethrow so the 500 handler sees it. */
export function rethrowUnlessMapped(res: Response, error: unknown): void {
  const status = mappedStatus(error);
  if (status === null) {
    throw error;
  }
  res.status(status).json({ error: (error as Error).message });
}

function issue(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? `${first.path.join(".") || "body"}: ${first.message}` : "invalid";
}
