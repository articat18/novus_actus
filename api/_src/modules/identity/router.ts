/**
 * Email + password identity HTTP API.
 *
 * Routes (mounted under /api/v1):
 *   POST /auth/sign-up   -> create an account and open a session
 *   POST /auth/sign-in   -> verify credentials and open a session
 *   GET  /auth/me        -> the current account for a bearer token
 *   POST /auth/sign-out  -> revoke the current session
 *
 * The persistence layer is being migrated to MongoDB; the endpoints validate
 * their input and then return 501 until the identity collections are defined.
 */
import type { AuthUser, SessionResponse } from "@energy/shared";
import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../http.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidSessionError,
  NotImplementedError,
  UsernameAlreadyTakenError,
} from "./errors.js";
import {
  AuthService,
  type AuthenticatedUser,
  type IssuedSession,
} from "./service.js";

export interface AuthRuntime {
  sessionHmacKey: string;
  clock?: () => Date;
  tokenFactory?: () => string;
}

const SignUpSchema = z
  .object({
    email: z.string().email().max(320),
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_.-]+$/, "letters, numbers, and . _ - only"),
    password: z.string().min(8).max(200),
  })
  .strict();

// Sign-in stays permissive on shape (no `.email()`); the service rejects bad
// credentials with a single generic 401 that does not reveal the reason.
const SignInSchema = z
  .object({
    email: z.string().min(3).max(320),
    password: z.string().min(1).max(200),
  })
  .strict();

export function createAuthRouter(runtime: AuthRuntime): Router {
  const router = Router();
  const newService = (): AuthService =>
    new AuthService(runtime.sessionHmacKey, {
      clock: runtime.clock,
      tokenFactory: runtime.tokenFactory,
    });

  router.post(
    "/auth/sign-up",
    asyncHandler(async (req, res) => {
      const parsed = SignUpSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(422)
          .json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const issued = await newService().signUp(parsed.data);
        res.status(201).json(sessionBody(issued));
      } catch (error) {
        if (handleAuthError(res, error)) {
          return;
        }
        throw error;
      }
    }),
  );

  router.post(
    "/auth/sign-in",
    asyncHandler(async (req, res) => {
      const parsed = SignInSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(422)
          .json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const issued = await newService().signIn(parsed.data);
        res.status(200).json(sessionBody(issued));
      } catch (error) {
        if (handleAuthError(res, error)) {
          return;
        }
        throw error;
      }
    }),
  );

  router.get(
    "/auth/me",
    asyncHandler(async (req, res) => {
      const token = bearer(req.header("authorization"));
      if (token === null) {
        res.status(401).json({ error: "access token is required" });
        return;
      }
      try {
        const user = await newService().userForToken(token);
        res.status(200).json(userBody(user));
      } catch (error) {
        if (handleAuthError(res, error)) {
          return;
        }
        throw error;
      }
    }),
  );

  router.post(
    "/auth/sign-out",
    asyncHandler(async (req, res) => {
      const token = bearer(req.header("authorization"));
      if (token === null) {
        res.status(401).json({ error: "access token is required" });
        return;
      }
      try {
        await newService().signOut(token);
        res.status(204).end();
      } catch (error) {
        if (handleAuthError(res, error)) {
          return;
        }
        throw error;
      }
    }),
  );

  return router;
}

/** Map known auth errors to responses. Returns true when it handled the error. */
function handleAuthError(res: import("express").Response, error: unknown): boolean {
  if (error instanceof NotImplementedError) {
    res.status(501).json({ error: error.message });
    return true;
  }
  if (
    error instanceof EmailAlreadyRegisteredError ||
    error instanceof UsernameAlreadyTakenError
  ) {
    res.status(409).json({ error: error.message });
    return true;
  }
  if (error instanceof InvalidCredentialsError) {
    res.status(401).json({ error: error.message });
    return true;
  }
  if (error instanceof InvalidSessionError) {
    res.status(401).json({ error: error.message });
    return true;
  }
  return false;
}

function sessionBody(issued: IssuedSession): SessionResponse {
  return {
    accessToken: issued.accessToken,
    tokenType: "bearer",
    expiresAt: issued.expiresAt.toISOString(),
    user: userBody(issued.user),
  };
}

function userBody(user: AuthenticatedUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
  };
}

function bearer(header: string | undefined): string | null {
  if (header === undefined || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function issue(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? `${first.path.join(".") || "body"}: ${first.message}` : "invalid";
}
