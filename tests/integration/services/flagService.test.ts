import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import { createTurnFlag } from '$lib/server/services/flagService';

describe('FlagService', () => {
  describe('createTurnFlag', () => {
    beforeEach(async () => {
      // Create a test game and turn that can be referenced
      const game = await prisma.game.create({
        data: {
          id: 'test-game-1',
          configId: 'default',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

      await prisma.turn.create({
        data: {
          id: 'test-turn-1',
          gameId: game.id,
          playerId: 'test-player-1',
          orderIndex: 0,
          isDrawing: false,
          content: 'Test content',
        },
      });
    });

    it('should create a turn flag', async () => {
      const flag = await createTurnFlag('test-turn-1', 'test-player-2', 'spam', 'This is spam');

      expect(flag.turnId).toBe('test-turn-1');
      expect(flag.playerId).toBe('test-player-2');
      expect(flag.reason).toBe('spam');
      expect(flag.explanation).toBe('This is spam');
      expect(flag.resolvedAt).toBeNull();
      expect(flag.id).toBeDefined();
      expect(flag.createdAt).toBeDefined();
    });
  });
});
