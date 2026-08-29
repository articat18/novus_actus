-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('family', 'organization');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "user_credential" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "kind" "OrganizationKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_membership" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "organization_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_credential_account_id_key" ON "user_credential"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_credential_normalized_email_key" ON "user_credential"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_membership_account_id_idx" ON "organization_membership"("account_id");

-- CreateIndex
CREATE INDEX "organization_membership_organization_id_idx" ON "organization_membership"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_membership_organization_id_account_id_key" ON "organization_membership"("organization_id", "account_id");

-- AddForeignKey
ALTER TABLE "user_credential" ADD CONSTRAINT "user_credential_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
