CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationLog_dedupKey_key" ON "NotificationLog"("dedupKey");
CREATE INDEX "NotificationLog_organizationId_idx" ON "NotificationLog"("organizationId");
