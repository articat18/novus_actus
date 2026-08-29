/**
 * Platform-owned contract for read-only university verification
 * (port of platform_app.modules.university.contracts).
 *
 * The platform never reaches roster tables directly; it depends only on this
 * gateway interface. The default implementation queries the roster tables in
 * process (see roster-gateway.ts); an HTTP implementation (http-gateway.ts)
 * can call a separately deployed pseudo-university service instead.
 */

export const VerificationStatus = {
  active: "active",
  inactive: "inactive",
  not_found: "not_found",
} as const;

export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export interface VerifiedResidenceContract {
  buildingReference: string;
  apartmentReference: string;
  roomReference: string;
  sourceVersion: string;
}

export interface UniversityVerification {
  status: VerificationStatus;
  universityReference: string | null;
  studentReference: string | null;
  residence: VerifiedResidenceContract | null;
}

export interface UniversityVerificationGateway {
  /** Return authoritative enrolment and effective residence at `at`. */
  verifyResident(email: string, at: Date): Promise<UniversityVerification>;
}
