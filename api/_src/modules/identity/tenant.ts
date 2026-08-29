/**
 * Tenant-scoped identity repository and explicit platform override
 * (port of platform_app.modules.identity.tenant).
 *
 * Reads deny cross-tenant access by default. A platform operator may select
 * another tenant only through an explicit, reasoned {@link PlatformTenantOverride},
 * which writes an audit event.
 */
import type { PrismaClient, UserProfile } from "@prisma/client";

import type { PrismaTransaction } from "../../db.js";

type Db = PrismaClient | PrismaTransaction;

export class TenantAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAccessDeniedError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor(message = "profile not found") {
    super(message);
    this.name = "ProfileNotFoundError";
  }
}

export interface TenantContext {
  readonly kind: "tenant";
  readonly universityId: string;
  readonly actorAccountId?: string | null;
}

export interface PlatformTenantOverride {
  readonly kind: "override";
  readonly actorAccountId: string;
  readonly targetUniversityId: string;
  readonly reason: string;
}

export function tenantContext(
  universityId: string,
  actorAccountId: string | null = null,
): TenantContext {
  return { kind: "tenant", universityId, actorAccountId };
}

export function platformTenantOverride(
  actorAccountId: string,
  targetUniversityId: string,
  reason: string,
): PlatformTenantOverride {
  if (reason.trim() === "") {
    throw new Error("a platform tenant override requires a reason");
  }
  return { kind: "override", actorAccountId, targetUniversityId, reason };
}

export type TenantScope = TenantContext | PlatformTenantOverride;

export class IdentityRepository {
  constructor(private readonly db: Db) {}

  async listProfiles(scope: TenantScope): Promise<UserProfile[]> {
    const universityId = resolveUniversityId(scope);
    await this.auditOverride(scope, "user_profile", null);
    return this.db.userProfile.findMany({
      where: { universityId },
      orderBy: { id: "asc" },
    });
  }

  async getProfile(profileId: string, scope: TenantScope): Promise<UserProfile> {
    const profile = await this.db.userProfile.findUnique({
      where: { id: profileId },
    });
    if (profile === null) {
      throw new ProfileNotFoundError();
    }
    const universityId = resolveUniversityId(scope);
    if (profile.universityId !== universityId) {
      throw new TenantAccessDeniedError("profile belongs to another university");
    }
    await this.auditOverride(scope, "user_profile", profile.id);
    return profile;
  }

  private async auditOverride(
    scope: TenantScope,
    targetType: string,
    targetId: string | null,
  ): Promise<void> {
    if (scope.kind !== "override") {
      return;
    }
    await this.db.auditEvent.create({
      data: {
        universityId: scope.targetUniversityId,
        actorAccountId: scope.actorAccountId,
        action: "platform.cross_tenant.read",
        targetType,
        targetId,
        reason: scope.reason,
        beforeState: undefined,
        afterState: { selected_university_id: scope.targetUniversityId },
      },
    });
  }
}

function resolveUniversityId(scope: TenantScope): string {
  return scope.kind === "override" ? scope.targetUniversityId : scope.universityId;
}
