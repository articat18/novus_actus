/**
 * Read-only university roster verification HTTP interface — STUB.
 *
 * The roster data store is being migrated to MongoDB. The endpoint shape is
 * preserved (GET is read-only; other methods are rejected), but it reports 501
 * until the roster collections are defined.
 */
import { Router } from "express";

export function createVerificationRouter(): Router {
  const router = Router();

  router.get("/residents", (_req, res) => {
    res.status(501).json({
      error: "roster verification is not implemented yet (MongoDB schema pending)",
    });
  });

  // The verification surface is strictly read-only: reject other methods.
  router.all("/residents", (_req, res) => {
    res.status(405).json({ error: "method not allowed" });
  });

  return router;
}
