-- CreateTable
CREATE TABLE "player_favorites" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "favoritingPlayerId" TEXT NOT NULL,
    "favoritedPlayerId" TEXT NOT NULL,

    CONSTRAINT "player_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_favorites_favoritingPlayerId_favoritedPlayerId_key" ON "player_favorites"("favoritingPlayerId", "favoritedPlayerId");

-- AddForeignKey
ALTER TABLE "player_favorites" ADD CONSTRAINT "player_favorites_favoritingPlayerId_fkey" FOREIGN KEY ("favoritingPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_favorites" ADD CONSTRAINT "player_favorites_favoritedPlayerId_fkey" FOREIGN KEY ("favoritedPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
