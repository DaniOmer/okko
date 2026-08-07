CREATE TABLE "Beneficiary" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Beneficiary_organizationId_idx" ON "Beneficiary"("organizationId");
