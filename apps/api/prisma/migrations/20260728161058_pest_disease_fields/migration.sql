-- AlterTable
ALTER TABLE "Pest" ADD COLUMN     "advancedSymptoms" JSONB,
ADD COLUMN     "confusionRisk" JSONB,
ADD COLUMN     "evolutionSpeed" TEXT,
ADD COLUMN     "firstSymptoms" JSONB,
ADD COLUMN     "pathogen" JSONB,
ADD COLUMN     "potentialLosses" JSONB,
ADD COLUMN     "propagationModes" JSONB;
