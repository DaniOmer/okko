-- AlterTable
ALTER TABLE "AgroEcologicalZone" ADD COLUMN     "climateType" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" JSONB,
ADD COLUMN     "drainage" TEXT,
ADD COLUMN     "drySeasonEnd" TEXT,
ADD COLUMN     "drySeasonStart" TEXT,
ADD COLUMN     "fertility" TEXT,
ADD COLUMN     "meanHumidity" DOUBLE PRECISION,
ADD COLUMN     "meanTemperature" DOUBLE PRECISION,
ADD COLUMN     "rainySeasonEnd" TEXT,
ADD COLUMN     "rainySeasonStart" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "soilTypes" JSONB;
