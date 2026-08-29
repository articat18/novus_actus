/**
 * Read-only roster verification queries
 * (port of pseudo_university_app.verification.repository).
 *
 * Resolves active enrolment and effective residence at a requested instant.
 */
import type { PrismaClient } from "@prisma/client";

import type { PrismaTransaction } from "../../db.js";
import {
  VerificationStatus,
  type UniversityVerification,
} from "./contracts.js";

type Db = PrismaClient | PrismaTransaction;

export class RosterVerificationService {
  constructor(private readonly db: Db) {}

  async verify(email: string, at: Date): Promise<UniversityVerification> {
    if (Number.isNaN(at.getTime())) {
      throw new Error("verification time must be a valid instant");
    }
    const normalizedEmail = email.trim().toLowerCase();

    const student = await this.db.student.findFirst({
      where: { normalizedEmail },
    });
    if (student === null) {
      return {
        status: VerificationStatus.not_found,
        universityReference: null,
        studentReference: null,
        residence: null,
      };
    }

    const university = await this.db.rosterUniversity.findUnique({
      where: { id: student.universityId },
    });
    if (university === null) {
      throw new Error("student references a missing university");
    }

    const effectiveWhere = {
      effectiveStart: { lte: at },
      OR: [{ effectiveEnd: null }, { effectiveEnd: { gt: at } }],
    };

    const activeEnrollment = await this.db.enrollment.findFirst({
      where: { studentId: student.id, active: true, ...effectiveWhere },
    });
    const residence = await this.db.residenceAssignment.findFirst({
      where: { studentId: student.id, ...effectiveWhere },
      include: {
        room: { include: { apartment: { include: { building: true } } } },
      },
    });

    if (activeEnrollment === null || residence === null) {
      return {
        status: VerificationStatus.inactive,
        universityReference: university.externalReference,
        studentReference: student.externalReference,
        residence: null,
      };
    }

    return {
      status: VerificationStatus.active,
      universityReference: university.externalReference,
      studentReference: student.externalReference,
      residence: {
        buildingReference: residence.room.apartment.building.externalReference,
        apartmentReference: residence.room.apartment.externalReference,
        roomReference: residence.room.externalReference,
        sourceVersion: residence.sourceVersion,
      },
    };
  }
}
