/**
 * Session-token → {@link Principal} resolution.
 *
 * Kept independent of {@link IdentityService} so any router can authenticate a
 * caller without constructing the passwordless activation flow (which needs an
 * email sender and a university gateway it would never use).
 */
import type { PrismaClient } from "@prisma/client";

import { digestSession } from "../../crypto.js";
import type { Principal } from "./authorization.js";
import { InvalidSessionError } from "./errors.js";

/**
 * Resolve an unexpired, unrevoked session token to its principal and role
 * grants. Throws {@link InvalidSessionError} for any token that does not
 * currently authenticate — never distinguishing unknown from expired.
 */
export async function resolvePrincipal(
  db: PrismaClient,
  sessionHmacKey: string,
  token: string,
  now: Date = new Date(),
): Promise<Principal> {
  const accessSession = await db.accessSession.findFirst({
    where: {
      tokenDigest: digestSession(sessionHmacKey, token),
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (accessSession === null) {
    throw new InvalidSessionError("access token is invalid");
  }
  const assignments = await db.roleAssignment.findMany({
    where: { accountId: accessSession.accountId },
  });
  return {
    accountId: accessSession.accountId,
    grants: assignments.map((row) => ({
      role: row.role,
      universityId: row.universityId,
      buildingId: row.buildingId,
    })),
  };
}
