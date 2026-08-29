/** Deny-by-default membership matrix and the owner-only escalation guards. */
import { describe, expect, it } from "vitest";

import {
  OrganizationPermission,
  permits,
  requireMayActOnMember,
  requireMayGrantRole,
  requirePermission,
} from "./authorization.js";
import { OrganizationAccessDeniedError } from "./errors.js";

const { VIEW, MANAGE_MEMBERS, MANAGE_ORGANIZATION } = OrganizationPermission;

describe("requirePermission", () => {
  it.each([
    ["owner", [VIEW, MANAGE_MEMBERS, MANAGE_ORGANIZATION]],
    ["admin", [VIEW, MANAGE_MEMBERS]],
    ["member", [VIEW]],
  ] as const)("grants %s exactly its own permissions", (role, allowed) => {
    for (const permission of [VIEW, MANAGE_MEMBERS, MANAGE_ORGANIZATION]) {
      const attempt = (): void => requirePermission(role, permission);
      if ((allowed as readonly string[]).includes(permission)) {
        expect(attempt).not.toThrow();
      } else {
        expect(attempt).toThrow(OrganizationAccessDeniedError);
      }
    }
  });

  it("denies a non-member everything", () => {
    for (const permission of [VIEW, MANAGE_MEMBERS, MANAGE_ORGANIZATION]) {
      expect(() => requirePermission(null, permission)).toThrow(
        OrganizationAccessDeniedError,
      );
    }
    expect(permits(null, VIEW)).toBe(false);
  });
});

describe("requireMayGrantRole", () => {
  it("lets only an owner create another owner", () => {
    expect(() => requireMayGrantRole("owner", "owner")).not.toThrow();
    expect(() => requireMayGrantRole("admin", "owner")).toThrow(
      OrganizationAccessDeniedError,
    );
    expect(() => requireMayGrantRole("member", "owner")).toThrow(
      OrganizationAccessDeniedError,
    );
  });

  it("allows non-owner roles to be granted by any manager", () => {
    expect(() => requireMayGrantRole("admin", "admin")).not.toThrow();
    expect(() => requireMayGrantRole("admin", "member")).not.toThrow();
  });
});

describe("requireMayActOnMember", () => {
  it("protects owners from admins", () => {
    expect(() => requireMayActOnMember("admin", "owner")).toThrow(
      OrganizationAccessDeniedError,
    );
    expect(() => requireMayActOnMember("owner", "owner")).not.toThrow();
    expect(() => requireMayActOnMember("admin", "admin")).not.toThrow();
    expect(() => requireMayActOnMember("admin", "member")).not.toThrow();
  });
});
