/**
 * REQ-TEN-001 deny-by-default role matrix
 * (port of tests/test_identity_authorization.py).
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  AccessDeniedError,
  AuthorizationService,
  Permission,
  type Principal,
} from "./authorization.js";

describe("AuthorizationService", () => {
  it("limits a participant to self in their own tenant", () => {
    const universityId = randomUUID();
    const otherUniversityId = randomUUID();
    const buildingId = randomUUID();
    const principal: Principal = {
      accountId: randomUUID(),
      grants: [{ role: "participant", universityId, buildingId: null }],
    };
    const auth = new AuthorizationService();

    expect(() => auth.require(principal, Permission.VIEW_SELF, { universityId })).not.toThrow();

    const denied: Array<[Permission, string, string | null]> = [
      [Permission.VIEW_SELF, otherUniversityId, null],
      [Permission.VIEW_BUILDING, universityId, buildingId],
      [Permission.MANAGE_BUILDING, universityId, buildingId],
      [Permission.SELECT_TENANT, universityId, null],
    ];
    for (const [permission, tenant, building] of denied) {
      expect(() =>
        auth.require(principal, permission, { universityId: tenant, buildingId: building }),
      ).toThrow(AccessDeniedError);
    }
  });

  it("limits a building admin to the assigned building and tenant", () => {
    const universityId = randomUUID();
    const buildingId = randomUUID();
    const principal: Principal = {
      accountId: randomUUID(),
      grants: [{ role: "building_admin", universityId, buildingId }],
    };
    const auth = new AuthorizationService();

    for (const permission of [Permission.VIEW_BUILDING, Permission.MANAGE_BUILDING]) {
      expect(() => auth.require(principal, permission, { universityId, buildingId })).not.toThrow();
    }
    const denied: Array<[string, string]> = [
      [universityId, randomUUID()],
      [randomUUID(), buildingId],
    ];
    for (const [tenant, building] of denied) {
      expect(() =>
        auth.require(principal, Permission.MANAGE_BUILDING, {
          universityId: tenant,
          buildingId: building,
        }),
      ).toThrow(AccessDeniedError);
    }
  });

  it("requires a platform admin to explicitly select the target tenant", () => {
    const principal: Principal = {
      accountId: randomUUID(),
      grants: [{ role: "platform_admin", universityId: null, buildingId: null }],
    };
    const auth = new AuthorizationService();
    const targetUniversity = randomUUID();

    expect(() =>
      auth.require(principal, Permission.SELECT_TENANT, { universityId: targetUniversity }),
    ).toThrow(AccessDeniedError);
    expect(() =>
      auth.require(principal, Permission.SELECT_TENANT, {
        universityId: targetUniversity,
        platformTargetExplicit: true,
      }),
    ).not.toThrow();
  });

  it("denies every operation for an empty grant set", () => {
    const principal: Principal = { accountId: randomUUID(), grants: [] };
    expect(() =>
      new AuthorizationService().require(principal, Permission.VIEW_SELF, {
        universityId: randomUUID(),
      }),
    ).toThrow(AccessDeniedError);
  });
});
