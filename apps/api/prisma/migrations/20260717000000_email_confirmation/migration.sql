-- AlterTable
ALTER TABLE "User" ADD COLUMN     "confirmationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "confirmationToken" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_confirmationToken_key" ON "User"("confirmationToken");
