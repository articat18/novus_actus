/**
 * Framework-free contract types shared by the API and the web client.
 *
 * The HTTP surface uses camelCase JSON (idiomatic across the TypeScript stack).
 * These types describe request and response bodies only — never persistence.
 */

// ---------------------------------------------------------------------------
// Domain vocabulary
// ---------------------------------------------------------------------------

export type RoleName = "participant" | "building_admin" | "platform_admin";

export type VerificationStatusName = "active" | "inactive" | "not_found";

// ---------------------------------------------------------------------------
// Identity: passwordless challenge / verify / session
// ---------------------------------------------------------------------------

export interface ChallengeRequest {
  email: string;
}

export interface ChallengeResponse {
  challengeId: string;
  /** ISO-8601 UTC instant. */
  expiresAt: string;
  message: string;
}

export interface ChallengeVerification {
  challengeId: string;
  code: string;
  username: string;
}

export interface SessionResponse {
  accessToken: string;
  tokenType: "bearer";
  /** ISO-8601 UTC instant. */
  expiresAt: string;
  username: string;
  roles: RoleName[];
}

export interface UsernameChange {
  username: string;
}

export interface UsernameResponse {
  username: string;
}

// ---------------------------------------------------------------------------
// University verification (read-only roster contract)
// ---------------------------------------------------------------------------

export interface ResidenceResult {
  buildingReference: string;
  apartmentReference: string;
  roomReference: string;
  sourceVersion: string;
}

export interface VerificationResponse {
  status: VerificationStatusName;
  universityReference?: string | null;
  studentReference?: string | null;
  residence?: ResidenceResult | null;
}

// ---------------------------------------------------------------------------
// Accounts: email + password sign-in
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AccountResponse {
  accountId: string;
  email: string;
  displayName: string;
}

export interface AccountSessionResponse {
  accessToken: string;
  tokenType: "bearer";
  /** ISO-8601 UTC instant. */
  expiresAt: string;
  account: AccountResponse;
}

// ---------------------------------------------------------------------------
// Organizations (families and companies)
// ---------------------------------------------------------------------------

export type OrganizationKindName = "family" | "organization";

export type OrganizationRoleName = "owner" | "admin" | "member";

export interface CreateOrganizationRequest {
  kind: OrganizationKindName;
  name: string;
}

export interface AddMemberRequest {
  email: string;
  role: OrganizationRoleName;
}

export interface ChangeMemberRoleRequest {
  role: OrganizationRoleName;
}

export interface OrganizationMemberResponse {
  accountId: string;
  displayName: string;
  role: OrganizationRoleName;
  /** ISO-8601 UTC instant. */
  joinedAt: string;
  /** Present only for viewers who may manage members. */
  email?: string;
}

export interface OrganizationSummaryResponse {
  organizationId: string;
  kind: OrganizationKindName;
  name: string;
  slug: string;
  /** The caller's own role in this organization. */
  role: OrganizationRoleName;
  memberCount: number;
}

export interface OrganizationListResponse {
  organizations: OrganizationSummaryResponse[];
}

export interface OrganizationResponse {
  organizationId: string;
  kind: OrganizationKindName;
  name: string;
  slug: string;
  role: OrganizationRoleName;
  members: OrganizationMemberResponse[];
}

// ---------------------------------------------------------------------------
// Profiles (tenant-scoped reads)
// ---------------------------------------------------------------------------

/** Public/own profile fields only. Never carries email or residence. */
export interface ProfileResponse {
  profileId: string;
  username: string;
  /** ISO-8601 UTC instant. */
  createdAt: string;
}

export interface ProfileListResponse {
  universityId: string;
  profiles: ProfileResponse[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: string;
  detail?: string;
}
