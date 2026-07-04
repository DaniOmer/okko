-- CreateTable
CREATE TABLE "PestDisease" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "scientificName" TEXT,
    "symptoms" JSONB,
    "photos" JSONB NOT NULL,
    "notes" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PestDisease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropPestControl" (
    "cropId" TEXT NOT NULL,
    "pestId" TEXT NOT NULL,
    "susceptibility" TEXT NOT NULL,
    "sensitiveStages" JSONB NOT NULL,
    "threshold" TEXT,
    "controlMethods" JSONB NOT NULL,
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropPestControl_pkey" PRIMARY KEY ("cropId","pestId")
);

-- CreateIndex
CREATE INDEX "CropPestControl_pestId_idx" ON "CropPestControl"("pestId");
