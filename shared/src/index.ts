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
// Errors
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: string;
  detail?: string;
}
