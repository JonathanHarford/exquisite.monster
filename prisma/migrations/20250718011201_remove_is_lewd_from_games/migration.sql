/*
  Warnings:

  - You are about to drop the column `isLewd` on the `games` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "games_isLewd_completedAt_deletedAt_idx";

-- DropIndex
DROP INDEX "games_isLewd_completedAt_idx";

-- DropIndex
DROP INDEX "games_isLewd_deletedAt_idx";

-- DropIndex
DROP INDEX "games_isLewd_idx";

-- AlterTable
ALTER TABLE "games" DROP COLUMN "isLewd";
