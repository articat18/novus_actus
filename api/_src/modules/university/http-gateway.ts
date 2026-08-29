/**
 * HTTP university verification gateway
 * (port of platform_app.adapters.university_http).
 *
 * Calls a separately deployed read-only pseudo-university API. Selected when
 * UNIVERSITY_GATEWAY=http. Uses the global fetch (Node 18+).
 */
import { z } from "zod";

import type {
  UniversityVerification,
  UniversityVerificationGateway,
} from "./contracts.js";

const ResidenceSchema = z.object({
  buildingReference: z.string(),
  apartmentReference: z.string(),
  roomReference: z.string(),
  sourceVersion: z.string(),
});

const VerificationSchema = z.object({
  status: z.enum(["active", "inactive", "not_found"]),
  universityReference: z.string().nullish(),
  studentReference: z.string().nullish(),
  residence: ResidenceSchema.nullish(),
});

export class HttpUniversityGateway implements UniversityVerificationGateway {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly timeoutMs = 5000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async verifyResident(
    email: string,
    at: Date,
  ): Promise<UniversityVerification> {
    const url = new URL(`${this.baseUrl}/api/v1/verification/residents`);
    url.searchParams.set("email", email);
    url.searchParams.set("at", at.toISOString());

    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `university verification request failed: ${response.status}`,
      );
    }
    const parsed = VerificationSchema.parse(await response.json());
    return {
      status: parsed.status,
      universityReference: parsed.universityReference ?? null,
      studentReference: parsed.studentReference ?? null,
      residence: parsed.residence ?? null,
    };
  }
}
