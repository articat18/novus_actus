/**
 * Scoped administration APIs.
 *
 * Currently the audited cross-tenant profile read: the only way a platform
 * operator may look outside their own tenant. Every such read requires an
 * explicit target tenant and a stated reason, and writes an audit event via
 * {@link IdentityRepository} (spec AD-008, REQ-ADM-001).
 *
 * Routes (mounted under /api/v1/admin):
 *   GET /profiles?universityId=<uuid>&reason=<text>  -> 200 tenant profiles
 */
import type { ProfileListResponse, ProfileResponse } from "@energy/shared";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { asyncHandler, bearerToken } from "../../http.js";
import { resolvePrincipal } from "../identity/authenticate.js";
import { AuthorizationService, Permission } from "../identity/authorization.js";
import { rethrowUnlessMapped } from "../identity/router.js";
import { IdentityRepository, platformTenantOverride } from "../identity/tenant.js";

export interface AdministrationRuntime {
  sessionHmacKey: string;
  clock?: () => Date;
}

const CrossTenantQuerySchema = z.object({
  universityId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export function createAdministrationRouter(
  db: PrismaClient,
  runtime: AdministrationRuntime,
): Router {
  const router = Router();
  const authorization = new AuthorizationService();
  const clock = runtime.clock ?? ((): Date => new Date());

  router.get(
    "/profiles",
    asyncHandler(async (req, res) => {
      const token = bearerToken(req);
      if (token === null) {
        res.status(401).json({ error: "access token is required" });
        return;
      }
      const parsed = CrossTenantQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(422).json({
          error: "invalid request",
          detail: "universityId (uuid) and reason are required",
        });
        return;
      }
      const { universityId, reason } = parsed.data;
      try {
        const principal = await resolvePrincipal(
          db,
          runtime.sessionHmacKey,
          token,
          clock(),
        );
        // Selecting another tenant is allowed only for a platform admin who
        // named the target explicitly — never as an implicit consequence of
        // holding the role.
        authorization.require(principal, Permission.SELECT_TENANT, {
          universityId,
          platformTargetExplicit: true,
        });
        const scope = platformTenantOverride(
          principal.accountId,
          universityId,
          reason,
        );
        const profiles = await new IdentityRepository(db).listProfiles(scope);
        const body: ProfileListResponse = {
          universityId,
          profiles: profiles.map(
            (profile): ProfileResponse => ({
              profileId: profile.id,
              username: profile.username,
              createdAt: profile.createdAt.toISOString(),
            }),
          ),
        };
        res.status(200).json(body);
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  return router;
}
