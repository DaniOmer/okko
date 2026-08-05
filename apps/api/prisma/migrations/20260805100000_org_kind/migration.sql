-- AlterTable : nouveau type d'organisation ; les orgs existantes sont celles d'Okko → PLATFORM
ALTER TABLE "Organization" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CUSTOMER';
UPDATE "Organization" SET "kind" = 'PLATFORM';
