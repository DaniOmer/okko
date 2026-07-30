-- AlterTable
ALTER TABLE "Pest" ADD COLUMN     "chemicalControl" JSONB,
ADD COLUMN     "cropRotation" JSONB,
ADD COLUMN     "culturalControl" JSONB,
ADD COLUMN     "curativeTreatment" JSONB,
ADD COLUMN     "disinfection" JSONB,
ADD COLUMN     "irrigationControl" JSONB,
ADD COLUMN     "prophylaxis" JSONB,
ADD COLUMN     "resistantVarieties" JSONB;
