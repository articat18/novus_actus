/**
 * Read-only verification HTTP interface (port of the pseudo-university API).
 *
 * Mounted under /api/v1/verification. This is the same-process expression of
 * what was a separately deployed service; the platform still only reaches it
 * through the gateway, never by importing roster models.
 */
import type { VerificationResponse } from "@energy/shared";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";

import { asyncHandler } from "../../http.js";
import { RosterVerificationService } from "./verification-service.js";

export function createVerificationRouter(db: PrismaClient): Router {
  const router = Router();
  const service = new RosterVerificationService(db);

  router.get(
    "/residents",
    asyncHandler(async (req, res) => {
      const email = req.query.email;
      const at = req.query.at;
      if (typeof email !== "string" || email.length < 3 || email.length > 320) {
        res.status(422).json({ error: "email query parameter is required" });
        return;
      }
      if (typeof at !== "string") {
        res.status(422).json({ error: "at query parameter is required" });
        return;
      }
      const atDate = new Date(at);
      if (Number.isNaN(atDate.getTime())) {
        res.status(422).json({ error: "at must be an ISO-8601 instant" });
        return;
      }
      const result = await service.verify(email, atDate);
      const body: VerificationResponse = {
        status: result.status,
        universityReference: result.universityReference,
        studentReference: result.studentReference,
        residence: result.residence,
      };
      res.json(body);
    }),
  );

  // The verification surface is strictly read-only: reject other methods.
  router.all("/residents", (_req, res) => {
    res.status(405).json({ error: "method not allowed" });
  });

  return router;
}
