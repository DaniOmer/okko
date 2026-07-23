-- AlterTable
ALTER TABLE "Pest" ADD COLUMN     "activityPeriods" JSONB,
ADD COLUMN     "cycleDurationDays" JSONB,
ADD COLUMN     "developmentStages" JSONB,
ADD COLUMN     "favorableConditions" JSONB,
ADD COLUMN     "generationsPerYear" JSONB,
ADD COLUMN     "lifeCycle" JSONB;
