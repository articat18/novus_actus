/**
 * Email + password authentication HTTP API.
 *
 * Routes (mounted under /api/v1):
 *   POST /auth/register  -> 201 create an account and open a session
 *   POST /auth/login     -> 200 open a session
 *   POST /auth/logout    -> 204 revoke the presented session
 *   GET  /me             -> 200 the signed-in account
 *
 * No OAuth, by design (see 58837d3).
 */
import type {
  AccountResponse,
  AccountSessionResponse,
} from "@energy/shared";
import type { PrismaClient, UserCredential } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";

import { asyncHandler, bearerToken } from "../../http.js";
import {
  AccountSessionError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRegistrationError,
} from "./errors.js";
import { AccountService } from "./service.js";

export interface AccountsRuntime {
  sessionHmacKey: string;
  clock?: () => Date;
  tokenFactory?: () => string;
}

const RegisterSchema = z
  .object({
    email: z.string().min(3).max(320),
    password: z.string().min(1).max(200),
    displayName: z.string().min(1).max(200),
  })
  .strict();

const LoginSchema = z
  .object({ email: z.string().min(3).max(320), password: z.string().min(1).max(200) })
  .strict();

export function createAccountsRouter(
  db: PrismaClient,
  runtime: AccountsRuntime,
): Router {
  const router = Router();
  const service = new AccountService(db, runtime.sessionHmacKey, {
    clock: runtime.clock,
    tokenFactory: runtime.tokenFactory,
  });

  router.post(
    "/auth/register",
    asyncHandler(async (req, res) => {
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const session = await service.register(
          parsed.data.email,
          parsed.data.password,
          parsed.data.displayName,
        );
        res.status(201).json(sessionBody(session.accessToken, session.expiresAt, session.credential));
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.post(
    "/auth/login",
    asyncHandler(async (req, res) => {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        // Never itemize which field was wrong on a sign-in attempt.
        res.status(401).json({ error: "email or password is incorrect" });
        return;
      }
      try {
        const session = await service.login(parsed.data.email, parsed.data.password);
        res.status(200).json(sessionBody(session.accessToken, session.expiresAt, session.credential));
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.post(
    "/auth/logout",
    asyncHandler(async (req, res) => {
      const token = bearerToken(req);
      if (token === null) {
        res.status(401).json({ error: "access token is required" });
        return;
      }
      await service.logout(token);
      res.status(204).end();
    }),
  );

  router.get(
    "/me",
    asyncHandler(async (req, res) => {
      const token = bearerToken(req);
      if (token === null) {
        res.status(401).json({ error: "access token is required" });
        return;
      }
      try {
        const credential = await service.credentialForToken(token);
        res.status(200).json(accountBody(credential));
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  return router;
}

export function accountBody(credential: UserCredential): AccountResponse {
  return {
    accountId: credential.accountId,
    email: credential.normalizedEmail,
    displayName: credential.displayName,
  };
}

function sessionBody(
  accessToken: string,
  expiresAt: Date,
  credential: UserCredential,
): AccountSessionResponse {
  return {
    accessToken,
    tokenType: "bearer",
    expiresAt: expiresAt.toISOString(),
    account: accountBody(credential),
  };
}

/** Status for each account error, or null when the failure is a genuine fault. */
export function mappedStatus(error: unknown): number | null {
  if (
    error instanceof InvalidCredentialsError ||
    error instanceof AccountSessionError
  ) {
    return 401;
  }
  if (error instanceof EmailAlreadyRegisteredError) {
    return 409;
  }
  if (error instanceof InvalidRegistrationError) {
    return 422;
  }
  return null;
}

function rethrowUnlessMapped(res: Response, error: unknown): void {
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
