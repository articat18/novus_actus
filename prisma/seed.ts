/**
 * Deterministic demo seed.
 *
 * Ports `pseudo_university_app/seed.py` (the roster's minimal active/inactive
 * scenario, with byte-for-byte identical UUIDv5 identifiers) and additionally
 * seeds the matching platform tenant so the passwordless flow works end-to-end
 * from a fresh database:
 *
 *   active@demo.edu    -> active enrolment + residence -> can participate
 *   inactive@demo.edu  -> inactive enrolment            -> roster-ineligible
 *   unknown@demo.edu   -> not on the roster             -> not_found
 *
 * It also seeds two email+password accounts and a family so the sign-in page
 * is usable from a fresh database:
 *
 *   sam@demo.family / demo-password-2026  -> owner of "The Demo Family"
 *   kim@demo.family / demo-password-2026  -> member of the same family
 *
 * The richer ~270-resident demo dataset (spec AC-UNI-001B) is future work,
 * tracked with the still-stubbed modules.
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { v5 as uuidv5 } from "uuid";

import { hashPassword } from "../api/_src/modules/accounts/password.js";

const prisma = new PrismaClient();

// Same namespace as the original Python seed, so identifiers are stable across
// the stack migration.
const SEED_NAMESPACE = "91134630-bb1c-4cb3-8e4f-7836a56f7c74";
const SEED = 2026;

/** Demo-only password. Never seed this into a real deployment. */
const DEMO_PASSWORD = "demo-password-2026";

const DEMO_MEMBERS = [
  { email: "sam@demo.family", displayName: "Sam Tan", role: "owner" },
  { email: "kim@demo.family", displayName: "Kim Lim", role: "member" },
] as const;

function seedId(label: string): string {
  return uuidv5(`${SEED}:${label}`, SEED_NAMESPACE);
}

const START = new Date("2026-01-01T00:00:00.000Z");
const ENDED = new Date("2026-06-01T00:00:00.000Z");

async function seedRoster(): Promise<void> {
  const universityId = seedId("university");
  const buildingId = seedId("building");
  const apartmentId = seedId("apartment");
  const roomId = seedId("room");
  const activeId = seedId("student-active");
  const inactiveId = seedId("student-inactive");

  await prisma.rosterUniversity.upsert({
    where: { id: universityId },
    update: {},
    create: {
      id: universityId,
      externalReference: "demo-university",
      name: "Demo University",
      normalizedEmailDomain: "demo.edu",
    },
  });
  await prisma.rosterBuilding.upsert({
    where: { id: buildingId },
    update: {},
    create: {
      id: buildingId,
      universityId,
      externalReference: "hall-1",
      name: "Hall 1",
    },
  });
  await prisma.rosterApartment.upsert({
    where: { id: apartmentId },
    update: {},
    create: {
      id: apartmentId,
      buildingId,
      externalReference: "hall-1-a01",
      label: "Apartment A01",
    },
  });
  await prisma.rosterRoom.upsert({
    where: { id: roomId },
    update: {},
    create: {
      id: roomId,
      apartmentId,
      externalReference: "hall-1-a01-r1",
      label: "Room 1",
    },
  });

  await prisma.student.upsert({
    where: { id: activeId },
    update: {},
    create: {
      id: activeId,
      universityId,
      externalReference: "student-active",
      normalizedEmail: "active@demo.edu",
    },
  });
  await prisma.student.upsert({
    where: { id: inactiveId },
    update: {},
    create: {
      id: inactiveId,
      universityId,
      externalReference: "student-inactive",
      normalizedEmail: "inactive@demo.edu",
    },
  });

  await prisma.enrollment.upsert({
    where: { id: seedId("enrollment-active") },
    update: {},
    create: {
      id: seedId("enrollment-active"),
      studentId: activeId,
      active: true,
      effectiveStart: START,
      effectiveEnd: null,
      sourceVersion: "roster-v1",
    },
  });
  await prisma.residenceAssignment.upsert({
    where: { id: seedId("residence-active") },
    update: {},
    create: {
      id: seedId("residence-active"),
      studentId: activeId,
      roomId,
      effectiveStart: START,
      effectiveEnd: null,
      sourceVersion: "residence-v1",
    },
  });
  await prisma.enrollment.upsert({
    where: { id: seedId("enrollment-inactive") },
    update: {},
    create: {
      id: seedId("enrollment-inactive"),
      studentId: inactiveId,
      active: false,
      effectiveStart: START,
      effectiveEnd: ENDED,
      sourceVersion: "roster-v1",
    },
  });
}

async function seedPlatformTenant(): Promise<void> {
  const universityId = seedId("platform-university");
  const domainId = seedId("platform-email-domain");

  await prisma.university.upsert({
    where: { id: universityId },
    update: {},
    create: {
      id: universityId,
      name: "Demo University",
      timezone: "Asia/Singapore",
      rosterReference: "demo-university",
      status: "active",
    },
  });
  await prisma.universityEmailDomain.upsert({
    where: { id: domainId },
    update: {},
    create: {
      id: domainId,
      universityId,
      normalizedDomain: "demo.edu",
    },
  });
}

/**
 * Two credential accounts and one family, so the email+password sign-in page
 * has something to show without registering first.
 */
async function seedDemoFamily(): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const organizationId = seedId("organization:demo-family");

  await prisma.organization.upsert({
    where: { id: organizationId },
    update: {},
    create: {
      id: organizationId,
      kind: "family",
      name: "The Demo Family",
      slug: "the-demo-family",
    },
  });

  for (const member of DEMO_MEMBERS) {
    const accountId = seedId(`account:${member.email}`);
    await prisma.userAccount.upsert({
      where: { id: accountId },
      update: {},
      create: { id: accountId, status: "active" },
    });
    await prisma.userCredential.upsert({
      where: { accountId },
      update: { displayName: member.displayName, passwordHash },
      create: {
        id: seedId(`credential:${member.email}`),
        accountId,
        normalizedEmail: member.email,
        displayName: member.displayName,
        passwordHash,
      },
    });
    await prisma.organizationMembership.upsert({
      where: {
        uq_organization_membership: { organizationId, accountId },
      },
      update: { role: member.role },
      create: {
        id: seedId(`membership:${member.email}`),
        organizationId,
        accountId,
        role: member.role,
      },
    });
  }
}

async function main(): Promise<void> {
  await seedRoster();
  await seedPlatformTenant();
  await seedDemoFamily();
  // eslint-disable-next-line no-console
  console.log(
    "Seeded demo tenant + roster. Try active@demo.edu (participates), " +
      "inactive@demo.edu (ineligible), unknown@demo.edu (not found).\n" +
      `Sign in with sam@demo.family or kim@demo.family / ${DEMO_PASSWORD}.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
