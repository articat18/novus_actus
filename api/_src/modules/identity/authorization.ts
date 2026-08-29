/**
 * Deny-by-default role authorization primitives
 * (port of platform_app.modules.identity.authorization).
 */
import type { RoleName } from "@energy/shared";

export class AccessDeniedError extends Error {
  constructor(message = "operation is not authorized") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export const Permission = {
  VIEW_SELF: "view_self",
  VIEW_BUILDING: "view_building",
  MANAGE_BUILDING: "manage_building",
  SELECT_TENANT: "select_tenant",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export interface RoleGrant {
  role: RoleName;
  universityId: string | null;
  buildingId: string | null;
}

export interface Principal {
  accountId: string;
  grants: RoleGrant[];
}

export interface RequireOptions {
  universityId: string;
  buildingId?: string | null;
  platformTargetExplicit?: boolean;
}

/** Authorize only explicit role, tenant, and building combinations. */
export class AuthorizationService {
  require(
    principal: Principal,
    permission: Permission,
    { universityId, buildingId = null, platformTargetExplicit = false }: RequireOptions,
  ): void {
    for (const grant of principal.grants) {
      if (grant.role === "platform_admin") {
        if (platformTargetExplicit) {
          return;
        }
        continue;
      }
      if (grant.universityId !== universityId) {
        continue;
      }
      if (grant.role === "participant" && permission === Permission.VIEW_SELF) {
        return;
      }
      if (grant.role === "building_admin") {
        if (permission === Permission.VIEW_SELF) {
          return;
        }
        if (
          (permission === Permission.VIEW_BUILDING ||
            permission === Permission.MANAGE_BUILDING) &&
          buildingId !== null &&
          grant.buildingId === buildingId
        ) {
          return;
        }
      }
    }
    throw new AccessDeniedError();
  }
}
