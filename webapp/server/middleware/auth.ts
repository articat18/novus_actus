import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getJwtSecret } from "../config/env";

export const SESSION_COOKIE = "novus_session";

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
  };
}

export function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  const token = request.cookies?.[SESSION_COOKIE] as string | undefined;

  if (!token) {
    response.status(401).json({ message: "Please sign in to continue." });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;

    if (!payload.sub) {
      throw new Error("Session subject is missing.");
    }

    request.auth = { userId: payload.sub };
    next();
  } catch {
    response.clearCookie(SESSION_COOKIE, { path: "/" });
    response.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}
