-- AlterTable
ALTER TABLE "Pest" ADD COLUMN     "favorableClimate" JSONB,
ADD COLUMN     "geographicAreas" JSONB,
ADD COLUMN     "knownPresence" JSONB;
