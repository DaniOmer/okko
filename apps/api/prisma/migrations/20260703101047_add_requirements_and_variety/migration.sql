-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "climatic" JSONB,
ADD COLUMN     "edaphic" JSONB;

-- CreateTable
CREATE TABLE "Variety" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "maturityDays" INTEGER,
    "yieldPotential" JSONB,
    "traits" JSONB NOT NULL,
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variety_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Variety_cropId_idx" ON "Variety"("cropId");
