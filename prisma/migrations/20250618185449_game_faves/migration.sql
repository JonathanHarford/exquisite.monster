-- CreateTable
CREATE TABLE "game_favorites" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "game_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_favorites_playerId_gameId_key" ON "game_favorites"("playerId", "gameId");

-- AddForeignKey
ALTER TABLE "game_favorites" ADD CONSTRAINT "game_favorites_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_favorites" ADD CONSTRAINT "game_favorites_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
