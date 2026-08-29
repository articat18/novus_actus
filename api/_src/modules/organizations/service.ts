/**
 * Organizations (families and companies) and their memberships.
 *
 * Every read and write is scoped by the caller's own membership, so an account
 * cannot see or touch an organization it does not belong to.
 */
import type {
  Organization,
  OrganizationKind,
  OrganizationMembership,
  OrganizationRole,
  PrismaClient,
  UserCredential,
} from "@prisma/client";

import {
  OrganizationPermission,
  requireMayActOnMember,
  requireMayGrantRole,
  requirePermission,
} from "./authorization.js";
import {
  AlreadyMemberError,
  LastOwnerError,
  MemberNotFoundError,
  OrganizationNotFoundError,
} from "./errors.js";
import { normalizeOrganizationName, slugify } from "./normalize.js";

const SLUG_ATTEMPTS = 5;

export interface MemberDetail {
  accountId: string;
  role: OrganizationRole;
  displayName: string;
  email: string;
  joinedAt: Date;
}

export interface OrganizationDetail {
  organization: Organization;
  viewerRole: OrganizationRole;
  members: MemberDetail[];
}

export interface OrganizationSummaryDetail {
  organization: Organization;
  role: OrganizationRole;
  memberCount: number;
}

export class OrganizationService {
  constructor(private readonly db: PrismaClient) {}

  /** Create an organization with the caller as its first owner. */
  async create(
    accountId: string,
    kind: OrganizationKind,
    name: string,
  ): Promise<OrganizationSummaryDetail> {
    const normalizedName = normalizeOrganizationName(name);
    const base = slugify(normalizedName);

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      try {
        const organization = await this.db.$transaction(async (tx) => {
          const created = await tx.organization.create({
            data: { kind, name: normalizedName, slug },
          });
          await tx.organizationMembership.create({
            data: {
              organizationId: created.id,
              accountId,
              role: "owner",
            },
          });
          return created;
        });
        return { organization, role: "owner", memberCount: 1 };
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        // Slug taken; try the next suffix.
      }
    }
    // Exhausted the readable suffixes — fall back to something certainly free.
    const organization = await this.db.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          kind,
          name: normalizedName,
          slug: `${base}-${Date.now().toString(36)}`,
        },
      });
      await tx.organizationMembership.create({
        data: { organizationId: created.id, accountId, role: "owner" },
      });
      return created;
    });
    return { organization, role: "owner", memberCount: 1 };
  }

  /** The organizations the caller belongs to. */
  async listForAccount(accountId: string): Promise<OrganizationSummaryDetail[]> {
    const memberships = await this.db.organizationMembership.findMany({
      where: { accountId },
      include: {
        organization: { include: { _count: { select: { memberships: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((membership) => ({
      organization: membership.organization,
      role: membership.role,
      memberCount: membership.organization._count.memberships,
    }));
  }

  /** An organization with its members, readable only by its own members. */
  async detail(
    accountId: string,
    organizationId: string,
  ): Promise<OrganizationDetail> {
    const viewerRole = await this.roleOf(accountId, organizationId);
    requirePermission(viewerRole, OrganizationPermission.VIEW);
    const organization = await this.db.organization.findUnique({
      where: { id: organizationId },
    });
    if (organization === null) {
      throw new OrganizationNotFoundError("organization not found");
    }
    const memberships = await this.db.organizationMembership.findMany({
      where: { organizationId },
      include: { account: { include: { credential: true } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      organization,
      viewerRole,
      members: memberships.map((membership) => ({
        accountId: membership.accountId,
        role: membership.role,
        displayName: membership.account.credential?.displayName ?? "Unknown",
        email: membership.account.credential?.normalizedEmail ?? "",
        joinedAt: membership.createdAt,
      })),
    };
  }

  /** Add an existing account, identified by its registered email, as a member. */
  async addMember(
    actorAccountId: string,
    organizationId: string,
    email: string,
    role: OrganizationRole,
  ): Promise<MemberDetail> {
    const actorRole = await this.roleOf(actorAccountId, organizationId);
    requirePermission(actorRole, OrganizationPermission.MANAGE_MEMBERS);
    requireMayGrantRole(actorRole, role);

    const credential = await this.findCredentialByEmail(email);
    const existing = await this.db.organizationMembership.findFirst({
      where: { organizationId, accountId: credential.accountId },
    });
    if (existing !== null) {
      throw new AlreadyMemberError("account is already a member");
    }
    const membership = await this.db.organizationMembership
      .create({
        data: { organizationId, accountId: credential.accountId, role },
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new AlreadyMemberError("account is already a member");
        }
        throw error;
      });
    return detailOf(membership, credential);
  }

  /** Change a member's role. */
  async changeMemberRole(
    actorAccountId: string,
    organizationId: string,
    subjectAccountId: string,
    role: OrganizationRole,
  ): Promise<MemberDetail> {
    const actorRole = await this.roleOf(actorAccountId, organizationId);
    requirePermission(actorRole, OrganizationPermission.MANAGE_MEMBERS);
    const subject = await this.membershipOrThrow(organizationId, subjectAccountId);
    requireMayActOnMember(actorRole, subject.role);
    requireMayGrantRole(actorRole, role);

    if (subject.role === "owner" && role !== "owner") {
      await this.assertNotLastOwner(organizationId, subjectAccountId);
    }
    const updated = await this.db.organizationMembership.update({
      where: { id: subject.id },
      data: { role },
    });
    const credential = await this.db.userCredential.findUnique({
      where: { accountId: subjectAccountId },
    });
    return detailOf(updated, credential);
  }

  /** Remove a member. An organization always keeps at least one owner. */
  async removeMember(
    actorAccountId: string,
    organizationId: string,
    subjectAccountId: string,
  ): Promise<void> {
    const actorRole = await this.roleOf(actorAccountId, organizationId);
    // Leaving voluntarily needs no management permission.
    if (actorAccountId !== subjectAccountId) {
      requirePermission(actorRole, OrganizationPermission.MANAGE_MEMBERS);
    } else {
      requirePermission(actorRole, OrganizationPermission.VIEW);
    }
    const subject = await this.membershipOrThrow(organizationId, subjectAccountId);
    if (actorAccountId !== subjectAccountId) {
      requireMayActOnMember(actorRole, subject.role);
    }
    if (subject.role === "owner") {
      await this.assertNotLastOwner(organizationId, subjectAccountId);
    }
    await this.db.organizationMembership.delete({ where: { id: subject.id } });
  }

  /** The caller's role in an organization, or null when not a member. */
  async roleOf(
    accountId: string,
    organizationId: string,
  ): Promise<OrganizationRole | null> {
    const membership = await this.db.organizationMembership.findFirst({
      where: { organizationId, accountId },
    });
    return membership?.role ?? null;
  }

  private async membershipOrThrow(
    organizationId: string,
    accountId: string,
  ): Promise<OrganizationMembership> {
    const membership = await this.db.organizationMembership.findFirst({
      where: { organizationId, accountId },
    });
    if (membership === null) {
      throw new MemberNotFoundError("member not found");
    }
    return membership;
  }

  private async assertNotLastOwner(
    organizationId: string,
    accountId: string,
  ): Promise<void> {
    const otherOwners = await this.db.organizationMembership.count({
      where: { organizationId, role: "owner", accountId: { not: accountId } },
    });
    if (otherOwners === 0) {
      throw new LastOwnerError(
        "an organization must keep at least one owner",
      );
    }
  }

  private async findCredentialByEmail(email: string): Promise<UserCredential> {
    const credential = await this.db.userCredential.findUnique({
      where: { normalizedEmail: email.trim().toLowerCase() },
    });
    if (credential === null) {
      throw new MemberNotFoundError("no account is registered with that email");
    }
    return credential;
  }
}

function detailOf(
  membership: OrganizationMembership,
  credential: UserCredential | null,
): MemberDetail {
  return {
    accountId: membership.accountId,
    role: membership.role,
    displayName: credential?.displayName ?? "Unknown",
    email: credential?.normalizedEmail ?? "",
    joinedAt: membership.createdAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}
