/*
  Warnings:

  - You are about to drop the column `date` on the `PricePoint` table. All the data in the column will be lost.
  - Added the required column `periodEnd` to the `PricePoint` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodStart` to the `PricePoint` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PricePoint" DROP COLUMN "date",
ADD COLUMN     "periodEnd" TEXT NOT NULL,
ADD COLUMN     "periodStart" TEXT NOT NULL;
