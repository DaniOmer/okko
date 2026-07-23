-- AlterTable
ALTER TABLE "Pest" ADD COLUMN     "attackedOrgans" JSONB,
ADD COLUMN     "damageTypes" JSONB,
ADD COLUMN     "harmfulnessLevel" TEXT;
