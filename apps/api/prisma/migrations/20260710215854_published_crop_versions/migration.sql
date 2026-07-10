/*
  Warnings:

  - The primary key for the `PublishedCrop` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `revision` to the `PublishedCrop` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PublishedCrop" DROP CONSTRAINT "PublishedCrop_pkey",
ADD COLUMN     "revision" INTEGER NOT NULL,
ADD CONSTRAINT "PublishedCrop_pkey" PRIMARY KEY ("cropId", "revision");
