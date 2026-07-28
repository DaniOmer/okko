-- CreateTable
CREATE TABLE "ZonePestPresence" (
    "zoneId" TEXT NOT NULL,
    "pestId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZonePestPresence_pkey" PRIMARY KEY ("zoneId","pestId")
);

-- CreateIndex
CREATE INDEX "ZonePestPresence_pestId_idx" ON "ZonePestPresence"("pestId");
