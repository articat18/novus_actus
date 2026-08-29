-- CreateEnum
CREATE TYPE "UniversityStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "EnrollmentState" AS ENUM ('pending', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "ModerationState" AS ENUM ('active', 'replaced');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('participant', 'building_admin', 'platform_admin');

-- CreateTable
CREATE TABLE "university" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "timezone" VARCHAR(100) NOT NULL,
    "roster_reference" VARCHAR(100),
    "status" "UniversityStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "university_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_email_domain" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "normalized_domain" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "university_email_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(200) NOT NULL,
    "status" "AccountStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_identity" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "external_student_reference" VARCHAR(200) NOT NULL,
    "enrollment_state" "EnrollmentState" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "university_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "normalized_username" VARCHAR(40) NOT NULL,
    "moderation_state" "ModerationState" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignment" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "university_id" UUID,
    "building_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "role_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "university_id" UUID,
    "actor_account_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(100) NOT NULL,
    "target_id" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "request_correlation_id" VARCHAR(100),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_session" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_digest" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_residence" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "building_reference" VARCHAR(100) NOT NULL,
    "apartment_reference" VARCHAR(100) NOT NULL,
    "room_reference" VARCHAR(100) NOT NULL,
    "source_version" VARCHAR(100) NOT NULL,
    "effective_start" TIMESTAMPTZ(6) NOT NULL,
    "effective_end" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verified_residence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_university" (
    "id" UUID NOT NULL,
    "external_reference" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "normalized_email_domain" VARCHAR(255) NOT NULL,

    CONSTRAINT "roster_university_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_building" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "external_reference" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,

    CONSTRAINT "roster_building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_apartment" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "external_reference" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "roster_apartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_room" (
    "id" UUID NOT NULL,
    "apartment_id" UUID NOT NULL,
    "external_reference" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "roster_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "external_reference" VARCHAR(100) NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL,
    "effective_start" TIMESTAMPTZ(6) NOT NULL,
    "effective_end" TIMESTAMPTZ(6),
    "source_version" VARCHAR(100) NOT NULL,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residence_assignment" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "effective_start" TIMESTAMPTZ(6) NOT NULL,
    "effective_end" TIMESTAMPTZ(6),
    "source_version" VARCHAR(100) NOT NULL,

    CONSTRAINT "residence_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "university_roster_reference_key" ON "university"("roster_reference");

-- CreateIndex
CREATE UNIQUE INDEX "university_email_domain_normalized_domain_key" ON "university_email_domain"("normalized_domain");

-- CreateIndex
CREATE INDEX "university_email_domain_university_id_idx" ON "university_email_domain"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_email_key" ON "user_account"("email");

-- CreateIndex
CREATE INDEX "university_identity_university_id_idx" ON "university_identity"("university_id");

-- CreateIndex
CREATE INDEX "university_identity_account_id_idx" ON "university_identity"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "university_identity_university_id_normalized_email_key" ON "university_identity"("university_id", "normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "university_identity_university_id_external_student_referenc_key" ON "university_identity"("university_id", "external_student_reference");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_identity_id_key" ON "user_profile"("identity_id");

-- CreateIndex
CREATE INDEX "user_profile_university_id_idx" ON "user_profile"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_university_id_normalized_username_key" ON "user_profile"("university_id", "normalized_username");

-- CreateIndex
CREATE INDEX "role_assignment_account_id_idx" ON "role_assignment"("account_id");

-- CreateIndex
CREATE INDEX "role_assignment_university_id_idx" ON "role_assignment"("university_id");

-- CreateIndex
CREATE INDEX "ix_role_assignment_scope" ON "role_assignment"("university_id", "building_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignment_account_id_role_university_id_building_id_key" ON "role_assignment"("account_id", "role", "university_id", "building_id");

-- CreateIndex
CREATE INDEX "audit_event_university_id_idx" ON "audit_event"("university_id");

-- CreateIndex
CREATE INDEX "audit_event_actor_account_id_idx" ON "audit_event"("actor_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_session_token_digest_key" ON "access_session"("token_digest");

-- CreateIndex
CREATE INDEX "access_session_account_id_idx" ON "access_session"("account_id");

-- CreateIndex
CREATE INDEX "verified_residence_identity_id_idx" ON "verified_residence"("identity_id");

-- CreateIndex
CREATE INDEX "verified_residence_university_id_idx" ON "verified_residence"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "roster_university_external_reference_key" ON "roster_university"("external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "roster_university_normalized_email_domain_key" ON "roster_university"("normalized_email_domain");

-- CreateIndex
CREATE UNIQUE INDEX "roster_building_university_id_external_reference_key" ON "roster_building"("university_id", "external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "roster_apartment_building_id_external_reference_key" ON "roster_apartment"("building_id", "external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "roster_room_apartment_id_external_reference_key" ON "roster_room"("apartment_id", "external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "student_university_id_external_reference_key" ON "student"("university_id", "external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "student_university_id_normalized_email_key" ON "student"("university_id", "normalized_email");

-- CreateIndex
CREATE INDEX "enrollment_student_id_idx" ON "enrollment"("student_id");

-- CreateIndex
CREATE INDEX "residence_assignment_student_id_idx" ON "residence_assignment"("student_id");

-- AddForeignKey
ALTER TABLE "university_email_domain" ADD CONSTRAINT "university_email_domain_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_identity" ADD CONSTRAINT "university_identity_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_identity" ADD CONSTRAINT "university_identity_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "university_identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_account_id_fkey" FOREIGN KEY ("actor_account_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_session" ADD CONSTRAINT "access_session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_residence" ADD CONSTRAINT "verified_residence_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_residence" ADD CONSTRAINT "verified_residence_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "university_identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_building" ADD CONSTRAINT "roster_building_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "roster_university"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_apartment" ADD CONSTRAINT "roster_apartment_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "roster_building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_room" ADD CONSTRAINT "roster_room_apartment_id_fkey" FOREIGN KEY ("apartment_id") REFERENCES "roster_apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "roster_university"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residence_assignment" ADD CONSTRAINT "residence_assignment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residence_assignment" ADD CONSTRAINT "residence_assignment_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "roster_room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-authored constraints (not expressible in the Prisma schema language).
-- These preserve the invariants enforced by the original SQLAlchemy models.
-- The NULLS NOT DISTINCT index requires PostgreSQL 15+ (Neon / Vercel Postgres).
-- ---------------------------------------------------------------------------

-- Case-normalization guards
ALTER TABLE "user_account"
    ADD CONSTRAINT "ck_user_account_email_lowercase"
    CHECK ("email" = lower("email"));

ALTER TABLE "university_email_domain"
    ADD CONSTRAINT "ck_university_email_domain_normalized_domain_lowercase"
    CHECK ("normalized_domain" = lower("normalized_domain"));

ALTER TABLE "university_identity"
    ADD CONSTRAINT "ck_university_identity_normalized_email_lowercase"
    CHECK ("normalized_email" = lower("normalized_email"));

ALTER TABLE "user_profile"
    ADD CONSTRAINT "ck_user_profile_normalized_username_lowercase"
    CHECK ("normalized_username" = lower("normalized_username"));

ALTER TABLE "roster_university"
    ADD CONSTRAINT "ck_roster_university_email_domain_lowercase"
    CHECK ("normalized_email_domain" = lower("normalized_email_domain"));

ALTER TABLE "student"
    ADD CONSTRAINT "ck_student_normalized_email_lowercase"
    CHECK ("normalized_email" = lower("normalized_email"));

-- Role scope: platform_admin is global, participant is tenant-scoped,
-- building_admin is building-scoped.
ALTER TABLE "role_assignment"
    ADD CONSTRAINT "ck_role_assignment_role_scope"
    CHECK (
        (role = 'platform_admin' AND university_id IS NULL AND building_id IS NULL)
        OR (role = 'participant' AND university_id IS NOT NULL AND building_id IS NULL)
        OR (role = 'building_admin' AND university_id IS NOT NULL AND building_id IS NOT NULL)
    );

-- Effective-scope uniqueness that treats NULLs as equal, so a participant
-- cannot receive duplicate tenant grants where building_id is NULL.
CREATE UNIQUE INDEX "uq_role_assignment_effective_scope"
    ON "role_assignment" ("account_id", "role", "university_id", "building_id")
    NULLS NOT DISTINCT;
