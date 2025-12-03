-- CreateIndex
CREATE INDEX "games_completedAt_idx" ON "games"("completedAt");

-- CreateIndex
CREATE INDEX "games_createdAt_idx" ON "games"("createdAt");

-- CreateIndex
CREATE INDEX "games_completedAt_deletedAt_idx" ON "games"("completedAt", "deletedAt");

-- CreateIndex
CREATE INDEX "players_bannedAt_idx" ON "players"("bannedAt");

-- CreateIndex
CREATE INDEX "turn_flags_resolvedAt_idx" ON "turn_flags"("resolvedAt");

-- CreateIndex
CREATE INDEX "turn_flags_turnId_resolvedAt_idx" ON "turn_flags"("turnId", "resolvedAt");

-- CreateIndex
CREATE INDEX "turns_rejectedAt_idx" ON "turns"("rejectedAt");

-- CreateIndex
CREATE INDEX "turns_completedAt_idx" ON "turns"("completedAt");

-- CreateIndex
CREATE INDEX "turns_playerId_completedAt_idx" ON "turns"("playerId", "completedAt");
