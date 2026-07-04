-- CreateTable
CREATE TABLE "CroppingWindow" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "sowingStart" TEXT,
    "sowingEnd" TEXT,
    "irrigationRequired" BOOLEAN NOT NULL,
    "operations" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CroppingWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CroppingWindow_cropId_idx" ON "CroppingWindow"("cropId");
