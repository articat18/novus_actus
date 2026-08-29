/**
 * In-process university verification gateway.
 *
 * Implements the platform's {@link UniversityVerificationGateway} by querying
 * the roster tables in the same database — the "merge into one app" wiring.
 */
import type { PrismaClient } from "@prisma/client";

import type {
  UniversityVerification,
  UniversityVerificationGateway,
} from "./contracts.js";
import { RosterVerificationService } from "./verification-service.js";

export class InProcessUniversityGateway
  implements UniversityVerificationGateway
{
  private readonly service: RosterVerificationService;

  constructor(db: PrismaClient) {
    this.service = new RosterVerificationService(db);
  }

  verifyResident(email: string, at: Date): Promise<UniversityVerification> {
    return this.service.verify(email, at);
  }
}
