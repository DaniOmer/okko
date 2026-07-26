-- AlterTable
ALTER TABLE "Pest" ADD COLUMN     "disseminationCapacity" TEXT,
ADD COLUMN     "emergenceDepth" JSONB,
ADD COLUMN     "nuisanceTypes" JSONB,
ADD COLUMN     "reproductionMode" JSONB,
ADD COLUMN     "seedBankLongevity" JSONB;
