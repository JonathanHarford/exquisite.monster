-- CreateIndex
CREATE INDEX "turns_gameId_completedAt_rejectedAt_idx" ON "public"."turns"("gameId", "completedAt", "rejectedAt");
