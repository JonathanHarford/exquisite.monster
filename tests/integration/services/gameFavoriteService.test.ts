import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import {
  favoriteGame,
  unfavoriteGame,
  getFavoritedGames,
  isGameFavorited,
  getGameFavoriteCount,
} from '$lib/server/services/gameFavoriteService';
// Integration tests always require a database - no conditional setup needed

describe('GameFavoriteService', () => {
  let testPlayerId: string;
  let testGameId: string;
  let testGameId2: string;

  beforeEach(async () => {
    // Create test data with unique identifiers
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const player = await prisma.player.create({
      data: {
        id: `test-fav-player-${uniqueId}`,
        username: `favtester-${uniqueId}`,
        imageUrl: '/img/test.png',
        isAdmin: false,
      },
    });
    testPlayerId = player.id;

    // Create unique configs for each game (since configId is unique)
    const config1 = await prisma.gameConfig.create({
      data: {
        id: `test-config-1-${uniqueId}`,
        minTurns: 2,
        maxTurns: 4,
        writingTimeout: 'PT2M',
        drawingTimeout: 'PT5M',
        gameTimeout: 'P1D',
      },
    });

    const game1 = await prisma.game.create({
      data: {
        id: `test-game-1-${uniqueId}`,
        configId: config1.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
      },
    });
    testGameId = game1.id;

    const config2 = await prisma.gameConfig.create({
      data: {
        id: `test-config-2-${uniqueId}`,
        minTurns: 2,
        maxTurns: 4,
        writingTimeout: 'PT2M',
        drawingTimeout: 'PT5M',
        gameTimeout: 'P1D',
      },
    });

    const game2 = await prisma.game.create({
      data: {
        id: `test-game-2-${uniqueId}`,
        configId: config2.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
      },
    });
    testGameId2 = game2.id;
  });

  afterEach(async () => {
    // Clean up test data if IDs are set
    if (testPlayerId) {
      await prisma.gameFavorite.deleteMany({
        where: { playerId: testPlayerId },
      });
    }

    const gameIds = [testGameId, testGameId2].filter(Boolean);
    if (gameIds.length > 0) {
      await prisma.game.deleteMany({
        where: { id: { in: gameIds } },
      });
    }

    if (testPlayerId) {
      await prisma.player.deleteMany({
        where: { id: testPlayerId },
      });
    }
  });

  describe('favoriteGame', () => {
    it('should favorite a game', async () => {
      await favoriteGame(testPlayerId, testGameId);

      const favorite = await prisma.gameFavorite.findUnique({
        where: {
          playerId_gameId: {
            playerId: testPlayerId,
            gameId: testGameId,
          },
        },
      });

      expect(favorite).not.toBeNull();
      expect(favorite?.playerId).toBe(testPlayerId);
      expect(favorite?.gameId).toBe(testGameId);
    });

    it('should not throw an error if the game is already favorited', async () => {
      // First, favorite the game
      await favoriteGame(testPlayerId, testGameId);

      // Try to favorite again - should not throw
      await expect(favoriteGame(testPlayerId, testGameId)).resolves.not.toThrow();

      // Should still only have one favorite record
      const count = await prisma.gameFavorite.count({
        where: {
          playerId: testPlayerId,
          gameId: testGameId,
        },
      });
      expect(count).toBe(1);
    });
  });

  describe('unfavoriteGame', () => {
    it('should unfavorite a game', async () => {
      // First, favorite the game
      await favoriteGame(testPlayerId, testGameId);

      // Verify it's favorited
      let favorite = await prisma.gameFavorite.findUnique({
        where: {
          playerId_gameId: {
            playerId: testPlayerId,
            gameId: testGameId,
          },
        },
      });
      expect(favorite).not.toBeNull();

      // Unfavorite it
      await unfavoriteGame(testPlayerId, testGameId);

      // Verify it's removed
      favorite = await prisma.gameFavorite.findUnique({
        where: {
          playerId_gameId: {
            playerId: testPlayerId,
            gameId: testGameId,
          },
        },
      });
      expect(favorite).toBeNull();
    });

    it('should not throw an error if the game is not favorited', async () => {
      // Try to unfavorite a game that was never favorited
      await expect(unfavoriteGame(testPlayerId, testGameId)).resolves.not.toThrow();
    });
  });

  describe('getFavoritedGames', () => {
    it('should return a list of favorited games', async () => {
      // Favorite both games with a small delay to ensure distinct timestamps
      await favoriteGame(testPlayerId, testGameId);
      // Wait 10ms to ensure different createdAt timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      await favoriteGame(testPlayerId, testGameId2);

      const games = await getFavoritedGames(testPlayerId);

      expect(games).toHaveLength(2);
      expect(games[0].id).toBe(testGameId2); // Most recent favorite first (descending by gameFavorite.createdAt)
      expect(games[1].id).toBe(testGameId);
    });
  });

  describe('isGameFavorited', () => {
    it('should return true if the game is favorited', async () => {
      // Favorite the game first
      await favoriteGame(testPlayerId, testGameId);

      const isFavorited = await isGameFavorited(testPlayerId, testGameId);

      expect(isFavorited).toBe(true);
    });

    it('should return false if the game is not favorited', async () => {
      const isFavorited = await isGameFavorited(testPlayerId, testGameId);

      expect(isFavorited).toBe(false);
    });
  });

  describe('getGameFavoriteCount', () => {
    it('should return the number of favorites for a game', async () => {
      // Create multiple players who favorite the same game
      const uniqueId2 = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const uniqueId3 = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const player2 = await prisma.player.create({
        data: {
          id: `test-fav-player2-${uniqueId2}`,
          username: `favtester2-${uniqueId2}`,
          imageUrl: '/img/test2.png',
          isAdmin: false,
        },
      });

      const player3 = await prisma.player.create({
        data: {
          id: `test-fav-player3-${uniqueId3}`,
          username: `favtester3-${uniqueId3}`,
          imageUrl: '/img/test3.png',
          isAdmin: false,
        },
      });

      // Three players favorite the same game
      await favoriteGame(testPlayerId, testGameId);
      await favoriteGame(player2.id, testGameId);
      await favoriteGame(player3.id, testGameId);

      const count = await getGameFavoriteCount(testGameId);

      expect(count).toBe(3);

      // Cleanup
      await prisma.gameFavorite.deleteMany({
        where: { playerId: { in: [player2.id, player3.id] } },
      });
      await prisma.player.deleteMany({
        where: { id: { in: [player2.id, player3.id] } },
      });
    });
  });
});
