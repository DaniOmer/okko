-- AlterTable: rename the primary key constraint (separate statement required by PostgreSQL)
ALTER TABLE "Pest" RENAME CONSTRAINT "PestDisease_pkey" TO "Pest_pkey";

-- AlterTable: add new columns
ALTER TABLE "Pest"
ADD COLUMN "description" JSONB,
ADD COLUMN "family" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
