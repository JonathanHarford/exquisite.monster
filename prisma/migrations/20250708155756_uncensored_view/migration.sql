/*
  Warnings:

  - You are about to drop the column `censoredView` on the `players` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "games" ADD COLUMN     "isLewd" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "players" DROP COLUMN "censoredView",
ADD COLUMN     "hideLewdContent" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "games_isLewd_idx" ON "games"("isLewd");
