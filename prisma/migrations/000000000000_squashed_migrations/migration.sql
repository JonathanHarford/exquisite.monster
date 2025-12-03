-- CreateTable
CREATE TABLE "game_configs" (
    "id" TEXT NOT NULL,
    "minTurns" INTEGER NOT NULL,
    "maxTurns" INTEGER,
    "writingTimeout" INTEGER NOT NULL,
    "drawingTimeout" INTEGER NOT NULL,
    "gameTimeout" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "aboutMe" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "birthday" TIMESTAMP(3),
    "censoredView" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "configId" TEXT NOT NULL,
    "seasonId" TEXT,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "startDeadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "gameConfigId" TEXT NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_players" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turns" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDrawing" BOOLEAN NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn_flags" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "turnId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "explanation" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "turn_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_username_key" ON "players"("username");

-- CreateIndex
CREATE UNIQUE INDEX "games_configId_key" ON "games"("configId");

-- CreateIndex
CREATE INDEX "games_deletedAt_idx" ON "games"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_gameConfigId_key" ON "seasons"("gameConfigId");

-- CreateIndex
CREATE INDEX "seasons_status_createdAt_idx" ON "seasons"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "season_players_seasonId_playerId_key" ON "season_players"("seasonId", "playerId");

-- CreateIndex
CREATE INDEX "turns_gameId_playerId_idx" ON "turns"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "turns_gameId_orderIndex_key" ON "turns"("gameId", "orderIndex");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_configId_fkey" FOREIGN KEY ("configId") REFERENCES "game_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_gameConfigId_fkey" FOREIGN KEY ("gameConfigId") REFERENCES "game_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_players" ADD CONSTRAINT "season_players_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_players" ADD CONSTRAINT "season_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_flags" ADD CONSTRAINT "turn_flags_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_flags" ADD CONSTRAINT "turn_flags_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

