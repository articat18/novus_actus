/**
 * Demo-only development inbox.
 *
 * There is no real email integration in the demo, so verification codes are
 * exposed here for the browser client to display. Mounted only when
 * ENABLE_DEV_INBOX is true — never enable it in a real deployment.
 */
import { Router } from "express";

import type { InMemoryEmailCodeSender } from "./modules/identity/ports.js";

export function createDevInboxRouter(sender: InMemoryEmailCodeSender): Router {
  const router = Router();
  router.get("/last-code", (req, res) => {
    const email = req.query.email;
    if (typeof email !== "string") {
      res.status(422).json({ error: "email query parameter is required" });
      return;
    }
    const normalized = email.trim().toLowerCase();
    const entry = sender.peek(normalized);
    if (entry === null) {
      res.status(404).json({ error: "no verification code issued for this address" });
      return;
    }
    res.json({
      email: normalized,
      code: entry.code,
      expiresAt: entry.expiresAt.toISOString(),
    });
  });
  return router;
}
