-- AlterTable
ALTER TABLE "game_configs" ADD COLUMN     "isLewd" BOOLEAN NOT NULL DEFAULT false;

-- Copy isLewd data from games to their corresponding game_configs
UPDATE "game_configs" 
SET "isLewd" = "games"."isLewd"
FROM "games"
WHERE "game_configs"."id" = "games"."configId";

-- CreateIndex
CREATE INDEX "games_isLewd_completedAt_idx" ON "games"("isLewd", "completedAt");

-- CreateIndex
CREATE INDEX "games_isLewd_deletedAt_idx" ON "games"("isLewd", "deletedAt");

-- CreateIndex
CREATE INDEX "games_isLewd_completedAt_deletedAt_idx" ON "games"("isLewd", "completedAt", "deletedAt");
