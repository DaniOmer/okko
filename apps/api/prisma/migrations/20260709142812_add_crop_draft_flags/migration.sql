-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "hasPublishedVersion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false;
