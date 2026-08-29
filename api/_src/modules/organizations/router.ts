/**
 * Organization and membership HTTP API.
 *
 * Routes (mounted under /api/v1):
 *   POST   /organizations                            -> 201 create
 *   GET    /organizations                            -> 200 the caller's own
 *   GET    /organizations/:id                        -> 200 detail + members
 *   POST   /organizations/:id/members                -> 201 add by email
 *   PATCH  /organizations/:id/members/:accountId     -> 200 change role
 *   DELETE /organizations/:id/members/:accountId     -> 204 remove or leave
 *
 * Every route requires a credential session; membership decides the rest.
 */
import type {
  OrganizationListResponse,
  OrganizationMemberResponse,
  OrganizationResponse,
  OrganizationSummaryResponse,
} from "@energy/shared";
import type { Organization, OrganizationRole, PrismaClient } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";

import { asyncHandler, bearerToken } from "../../http.js";
import { AccountSessionError } from "../accounts/errors.js";
import { AccountService } from "../accounts/service.js";
import { OrganizationPermission, permits } from "./authorization.js";
import {
  AlreadyMemberError,
  InvalidOrganizationError,
  LastOwnerError,
  MemberNotFoundError,
  OrganizationAccessDeniedError,
  OrganizationNotFoundError,
} from "./errors.js";
import {
  OrganizationService,
  type MemberDetail,
  type OrganizationSummaryDetail,
} from "./service.js";

export interface OrganizationsRuntime {
  sessionHmacKey: string;
  clock?: () => Date;
}

const CreateSchema = z
  .object({
    kind: z.enum(["family", "organization"]),
    name: z.string().min(1).max(200),
  })
  .strict();

const AddMemberSchema = z
  .object({
    email: z.string().min(3).max(320),
    role: z.enum(["owner", "admin", "member"]),
  })
  .strict();

const ChangeRoleSchema = z
  .object({ role: z.enum(["owner", "admin", "member"]) })
  .strict();

const IdSchema = z.string().uuid();

export function createOrganizationsRouter(
  db: PrismaClient,
  runtime: OrganizationsRuntime,
): Router {
  const router = Router();
  const accounts = new AccountService(db, runtime.sessionHmacKey, {
    clock: runtime.clock,
  });
  const service = new OrganizationService(db);

  /** Resolve the caller, or send 401 and return null. */
  const caller = async (
    req: Parameters<Parameters<typeof asyncHandler>[0]>[0],
    res: Response,
  ): Promise<string | null> => {
    const token = bearerToken(req);
    if (token === null) {
      res.status(401).json({ error: "access token is required" });
      return null;
    }
    try {
      const credential = await accounts.credentialForToken(token);
      return credential.accountId;
    } catch (error) {
      if (error instanceof AccountSessionError) {
        res.status(401).json({ error: "access token is invalid" });
        return null;
      }
      throw error;
    }
  };

  router.post(
    "/organizations",
    asyncHandler(async (req, res) => {
      const accountId = await caller(req, res);
      if (accountId === null) {
        return;
      }
      const parsed = CreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const created = await service.create(
          accountId,
          parsed.data.kind,
          parsed.data.name,
        );
        res.status(201).json(summaryBody(created));
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.get(
    "/organizations",
    asyncHandler(async (req, res) => {
      const accountId = await caller(req, res);
      if (accountId === null) {
        return;
      }
      const summaries = await service.listForAccount(accountId);
      const body: OrganizationListResponse = {
        organizations: summaries.map(summaryBody),
      };
      res.status(200).json(body);
    }),
  );

  router.get(
    "/organizations/:organizationId",
    asyncHandler(async (req, res) => {
      const accountId = await caller(req, res);
      if (accountId === null) {
        return;
      }
      const organizationId = IdSchema.safeParse(req.params.organizationId);
      if (!organizationId.success) {
        res.status(404).json({ error: "organization not found" });
        return;
      }
      try {
        const detail = await service.detail(accountId, organizationId.data);
        const canSeeEmails = permits(
          detail.viewerRole,
          OrganizationPermission.MANAGE_MEMBERS,
        );
        const body: OrganizationResponse = {
          ...identity(detail.organization),
          role: detail.viewerRole,
          members: detail.members.map((member) =>
            memberBody(member, canSeeEmails),
          ),
        };
        res.status(200).json(body);
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.post(
    "/organizations/:organizationId/members",
    asyncHandler(async (req, res) => {
      const accountId = await caller(req, res);
      if (accountId === null) {
        return;
      }
      const organizationId = IdSchema.safeParse(req.params.organizationId);
      if (!organizationId.success) {
        res.status(404).json({ error: "organization not found" });
        return;
      }
      const parsed = AddMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const member = await service.addMember(
          accountId,
          organizationId.data,
          parsed.data.email,
          parsed.data.role,
        );
        res.status(201).json(memberBody(member, true));
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.patch(
    "/organizations/:organizationId/members/:accountId",
    asyncHandler(async (req, res) => {
      const actorAccountId = await caller(req, res);
      if (actorAccountId === null) {
        return;
      }
      const organizationId = IdSchema.safeParse(req.params.organizationId);
      const subjectAccountId = IdSchema.safeParse(req.params.accountId);
      if (!organizationId.success || !subjectAccountId.success) {
        res.status(404).json({ error: "member not found" });
        return;
      }
      const parsed = ChangeRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid request", detail: issue(parsed.error) });
        return;
      }
      try {
        const member = await service.changeMemberRole(
          actorAccountId,
          organizationId.data,
          subjectAccountId.data,
          parsed.data.role,
        );
        res.status(200).json(memberBody(member, true));
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  router.delete(
    "/organizations/:organizationId/members/:accountId",
    asyncHandler(async (req, res) => {
      const actorAccountId = await caller(req, res);
      if (actorAccountId === null) {
        return;
      }
      const organizationId = IdSchema.safeParse(req.params.organizationId);
      const subjectAccountId = IdSchema.safeParse(req.params.accountId);
      if (!organizationId.success || !subjectAccountId.success) {
        res.status(404).json({ error: "member not found" });
        return;
      }
      try {
        await service.removeMember(
          actorAccountId,
          organizationId.data,
          subjectAccountId.data,
        );
        res.status(204).end();
      } catch (error) {
        rethrowUnlessMapped(res, error);
      }
    }),
  );

  return router;
}

function identity(
  organization: Organization,
): Pick<OrganizationResponse, "organizationId" | "kind" | "name" | "slug"> {
  return {
    organizationId: organization.id,
    kind: organization.kind,
    name: organization.name,
    slug: organization.slug,
  };
}

function summaryBody(
  detail: OrganizationSummaryDetail,
): OrganizationSummaryResponse {
  return {
    ...identity(detail.organization),
    role: detail.role,
    memberCount: detail.memberCount,
  };
}

function memberBody(
  member: MemberDetail,
  includeEmail: boolean,
): OrganizationMemberResponse {
  const body: OrganizationMemberResponse = {
    accountId: member.accountId,
    displayName: member.displayName,
    role: member.role satisfies OrganizationRole,
    joinedAt: member.joinedAt.toISOString(),
  };
  if (includeEmail) {
    body.email = member.email;
  }
  return body;
}

/** Status for each organization error, or null when the failure is a fault. */
export function mappedStatus(error: unknown): number | null {
  if (error instanceof OrganizationAccessDeniedError) {
    return 403;
  }
  if (
    error instanceof OrganizationNotFoundError ||
    error instanceof MemberNotFoundError
  ) {
    return 404;
  }
  if (error instanceof AlreadyMemberError || error instanceof LastOwnerError) {
    return 409;
  }
  if (error instanceof InvalidOrganizationError) {
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
