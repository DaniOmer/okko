-- AlterTable
ALTER TABLE "Pest" ADD COLUMN     "approvedProducts" JSONB,
ADD COLUMN     "biologicalControl" JSONB,
ADD COLUMN     "knownResistances" JSONB,
ADD COLUMN     "parasitoids" JSONB,
ADD COLUMN     "predators" JSONB,
ADD COLUMN     "prevention" JSONB;
