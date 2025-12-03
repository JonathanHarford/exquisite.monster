import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import { fetchGameConfig, fetchDefaultGameConfig } from '$lib/server/services/configService';

describe('ConfigService', () => {
  beforeEach(async () => {
    // Clean up any test-specific configs
    await prisma.gameConfig.deleteMany({
      where: { id: { startsWith: 'test-' } }
    });
  });

  describe('fetchGameConfig', () => {
    it('should return a game config if found', async () => {
      // Create a test config in the database
      const testConfig = await prisma.gameConfig.create({
        data: {
          id: 'test-game-config',
          minTurns: 2,
          maxTurns: 6,
          writingTimeout: '5m',
          drawingTimeout: '15m',
          gameTimeout: '1d',
          isLewd: false
        }
      });

      const config = await fetchGameConfig('test-game-config');
      expect(config).toEqual({
        minTurns: testConfig.minTurns,
        maxTurns: testConfig.maxTurns,
        writingTimeout: testConfig.writingTimeout,
        drawingTimeout: testConfig.drawingTimeout,
        gameTimeout: testConfig.gameTimeout,
        isLewd: testConfig.isLewd
      });
    });

    it('should throw an error if a game config is not found', async () => {
      await expect(fetchGameConfig('non-existent-game')).rejects.toThrow('Config not found: non-existent-game');
    });
  });

  describe('fetchDefaultGameConfig', () => {
    it('should return the default game config', async () => {
      const config = await fetchDefaultGameConfig();
      
      // Verify the seeded default config values (from setup.ts)
      expect(config.minTurns).toBe(2);
      expect(config.maxTurns).toBe(4);
      expect(config.writingTimeout).toBe('2m');
      expect(config.drawingTimeout).toBe('5m');
      expect(config.gameTimeout).toBe('1d');
      expect(config.isLewd).toBe(false);
    });

    it('should throw an error if the default game config is not found', async () => {
      // Delete the default config to test error case
      await prisma.gameConfig.delete({ where: { id: 'default' } });
      
      await expect(fetchDefaultGameConfig()).rejects.toThrow('Config not found: default');
      
      // Restore the default config for other tests
      await prisma.gameConfig.create({
        data: {
          id: 'default',
          minTurns: 2,
          maxTurns: 4,
          writingTimeout: '2m',
          drawingTimeout: '5m',
          gameTimeout: '1d',
          isLewd: false
        }
      });
    });
  });
});
