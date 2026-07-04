-- CreateTable
CREATE TABLE "AgroEcologicalZone" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "country" TEXT NOT NULL,
    "koppen" TEXT,
    "altitude" JSONB,
    "annualRainfall" JSONB,
    "notes" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroEcologicalZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropZoneSuitability" (
    "cropId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "justification" TEXT,
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropZoneSuitability_pkey" PRIMARY KEY ("cropId","zoneId")
);

-- CreateIndex
CREATE INDEX "CropZoneSuitability_zoneId_idx" ON "CropZoneSuitability"("zoneId");
