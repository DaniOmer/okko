-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "nutrition" JSONB,
ADD COLUMN     "yields" JSONB;

-- CreateTable
CREATE TABLE "PricePoint" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricePoint_cropId_idx" ON "PricePoint"("cropId");
