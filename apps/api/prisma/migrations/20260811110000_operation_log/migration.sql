CREATE TABLE "OperationLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "inputs" JSONB NOT NULL,
  "laborCost" DOUBLE PRECISION,
  "notes" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationLog_organizationId_idx" ON "OperationLog"("organizationId");
CREATE INDEX "OperationLog_campaignId_idx" ON "OperationLog"("campaignId");
