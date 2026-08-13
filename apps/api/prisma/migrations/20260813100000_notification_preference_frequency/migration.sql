ALTER TABLE "NotificationPreference" ADD COLUMN "reminderEveryNDays" INTEGER NOT NULL DEFAULT 1;
UPDATE "NotificationPreference" SET "reminderEveryNDays" = CASE WHEN "remindersEnabled" = false THEN 0 ELSE 1 END;
ALTER TABLE "NotificationPreference" DROP COLUMN "remindersEnabled";
