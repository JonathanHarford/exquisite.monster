/*
  Warnings:

  - Made the column `writingTimeout` on table `game_configs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `drawingTimeout` on table `game_configs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gameTimeout` on table `game_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."game_configs" ALTER COLUMN "writingTimeout" SET NOT NULL,
ALTER COLUMN "drawingTimeout" SET NOT NULL,
ALTER COLUMN "gameTimeout" SET NOT NULL;

-- CreateIndex
CREATE INDEX "turn_flags_playerId_idx" ON "public"."turn_flags"("playerId");

-- CreateIndex
CREATE INDEX "turns_gameId_completedAt_idx" ON "public"."turns"("gameId", "completedAt");
