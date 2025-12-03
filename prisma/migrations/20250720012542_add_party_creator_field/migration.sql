/*
  Warnings:

  - Added the required column `createdBy` to the `seasons` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "createdBy" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
