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
// Identity: email + password authentication
// ---------------------------------------------------------------------------

export interface SignUpRequest {
  email: string;
  username: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

/** Public account view — never includes the password digest. */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface SessionResponse {
  accessToken: string;
  tokenType: "bearer";
  /** ISO-8601 UTC instant. */
  expiresAt: string;
  user: AuthUser;
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
