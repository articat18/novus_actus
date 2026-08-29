/**
 * Deny-by-default membership authorization.
 *
 * Mirrors the platform's role-matrix approach: permissions are granted only by
 * an explicit entry, and a non-member (role `null`) is refused everything.
 * Kept separate from the university AuthorizationService because the scope is a
 * membership, not a tenant/building pair.
 */
import type { OrganizationRole } from "@prisma/client";

import { OrganizationAccessDeniedError } from "./errors.js";

export const OrganizationPermission = {
  /** Read the organization and its member list. */
  VIEW: "view_organization",
  /** Add, remove, and re-role members. */
  MANAGE_MEMBERS: "manage_members",
  /** Rename or otherwise reconfigure the organization itself. */
  MANAGE_ORGANIZATION: "manage_organization",
} as const;

export type OrganizationPermission =
  (typeof OrganizationPermission)[keyof typeof OrganizationPermission];

const MATRIX: Record<OrganizationRole, readonly OrganizationPermission[]> = {
  owner: [
    OrganizationPermission.VIEW,
    OrganizationPermission.MANAGE_MEMBERS,
    OrganizationPermission.MANAGE_ORGANIZATION,
  ],
  admin: [OrganizationPermission.VIEW, OrganizationPermission.MANAGE_MEMBERS],
  member: [OrganizationPermission.VIEW],
};

/** Authorize a permission for the caller's role, or throw. */
export function requirePermission(
  role: OrganizationRole | null,
  permission: OrganizationPermission,
): asserts role is OrganizationRole {
  if (role === null || !MATRIX[role].includes(permission)) {
    throw new OrganizationAccessDeniedError();
  }
}

/**
 * Only an owner may grant the owner role. Without this an admin could promote
 * themselves and acquire every permission.
 */
export function requireMayGrantRole(
  actor: OrganizationRole,
  target: OrganizationRole,
): void {
  if (target === "owner" && actor !== "owner") {
    throw new OrganizationAccessDeniedError(
      "only an owner may grant the owner role",
    );
  }
}

/** Only an owner may remove or re-role another owner. */
export function requireMayActOnMember(
  actor: OrganizationRole,
  subject: OrganizationRole,
): void {
  if (subject === "owner" && actor !== "owner") {
    throw new OrganizationAccessDeniedError(
      "only an owner may act on another owner",
    );
  }
}

/** True when the role carries a permission — for read-time response shaping. */
export function permits(
  role: OrganizationRole | null,
  permission: OrganizationPermission,
): boolean {
  return role !== null && MATRIX[role].includes(permission);
}
