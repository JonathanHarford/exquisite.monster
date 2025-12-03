import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nudgePlayer, getTurnNudgeStats } from '$lib/server/services/nudgeService';
import { prisma } from '$lib/server/prisma';
import { createNotification } from '$lib/server/services/notificationService';

// Mock dependencies
vi.mock('$lib/server/prisma', () => ({
	prisma: {
		player: {
			findUnique: vi.fn()
		},
		turn: {
			findUnique: vi.fn()
		},
		notification: {
			findFirst: vi.fn(),
			count: vi.fn()
		}
	}
}));

vi.mock('$lib/server/services/notificationService', () => ({
	createNotification: vi.fn()
}));

vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn()
	}
}));

describe('NudgeService', () => {
	const mockTurnId = 'turn-123';
	const mockGameId = 'game-456';
	const mockNudgerPlayerId = 'nudger-789';
	const mockNudgedPlayerId = 'nudged-abc';

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('nudgePlayer', () => {
		it('should successfully send a nudge when conditions are met', async () => {
			// Arrange
			const mockPlayer = { username: 'TestPlayer' };
			const mockTurn = {
				createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
				orderIndex: 2
			};

			(prisma.notification.findFirst as any).mockResolvedValue(null); // No recent nudge
			(prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
			(prisma.turn.findUnique as any).mockResolvedValue(mockTurn);
			(prisma.notification.count as any).mockResolvedValue(1); // 1 existing nudge
			(createNotification as any).mockResolvedValue({ id: 'notification-123' });

			// Act
			const result = await nudgePlayer(
				mockNudgerPlayerId,
				mockNudgedPlayerId,
				mockTurnId,
				mockGameId
			);

			// Assert
			expect(result.success).toBe(true);
			expect(result.message).toBe('Nudge sent to TestPlayer');
			expect(createNotification).toHaveBeenCalledWith({
				userId: mockNudgedPlayerId,
				type: 'nudge',
				data: {
					turnId: mockTurnId,
					gameId: mockGameId,
					nudgerPlayerId: mockNudgerPlayerId,
					nudgeCount: 2,
					waitTimeHours: 72,
					lastNudgeAt: expect.any(String)
				},
				actionUrl: `/play/${mockTurnId}`,
				templateData: {
					username: 'TestPlayer',
					waitTime: '3 days',
					turnIndex: '3'
				}
			});
		});

		it('should reject nudge when on cooldown', async () => {
			// Arrange
			const recentNudge = {
				createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
			};
			(prisma.notification.findFirst as any).mockResolvedValue(recentNudge);

			// Act
			const result = await nudgePlayer(
				mockNudgerPlayerId,
				mockNudgedPlayerId,
				mockTurnId,
				mockGameId
			);

			// Assert
			expect(result.success).toBe(false);
			expect(result.message).toBe('Nudge is on cooldown');
			expect(result.cooldownRemainingHours).toBe(12);
			expect(createNotification).not.toHaveBeenCalled();
		});

		it('should handle missing player gracefully', async () => {
			// Arrange
			(prisma.notification.findFirst as any).mockResolvedValue(null);
			(prisma.player.findUnique as any).mockResolvedValue(null);
			(prisma.turn.findUnique as any).mockResolvedValue({ createdAt: new Date(), orderIndex: 0 });

			// Act
			const result = await nudgePlayer(
				mockNudgerPlayerId,
				mockNudgedPlayerId,
				mockTurnId,
				mockGameId
			);

			// Assert
			expect(result.success).toBe(false);
			expect(result.message).toBe('Player or turn not found');
			expect(createNotification).not.toHaveBeenCalled();
		});

		it('should handle missing turn gracefully', async () => {
			// Arrange
			(prisma.notification.findFirst as any).mockResolvedValue(null);
			(prisma.player.findUnique as any).mockResolvedValue({ username: 'TestPlayer' });
			(prisma.turn.findUnique as any).mockResolvedValue(null);

			// Act
			const result = await nudgePlayer(
				mockNudgerPlayerId,
				mockNudgedPlayerId,
				mockTurnId,
				mockGameId
			);

			// Assert
			expect(result.success).toBe(false);
			expect(result.message).toBe('Player or turn not found');
			expect(createNotification).not.toHaveBeenCalled();
		});

		it('should format wait time correctly for different durations', async () => {
			// Test cases for different wait times
			const testCases = [
				{ hoursAgo: 1, expected: '1 hour' },
				{ hoursAgo: 2, expected: '2 hours' },
				{ hoursAgo: 25, expected: '1d 1h' },
				{ hoursAgo: 48, expected: '2 days' },
				{ hoursAgo: 72, expected: '3 days' }
			];

			for (const testCase of testCases) {
				// Arrange
				const mockPlayer = { username: 'TestPlayer' };
				const mockTurn = {
					createdAt: new Date(Date.now() - testCase.hoursAgo * 60 * 60 * 1000),
					orderIndex: 0
				};

				(prisma.notification.findFirst as any).mockResolvedValue(null);
				(prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
				(prisma.turn.findUnique as any).mockResolvedValue(mockTurn);
				(prisma.notification.count as any).mockResolvedValue(0);
				(createNotification as any).mockResolvedValue({ id: 'notification-123' });

				// Act
				await nudgePlayer(mockNudgerPlayerId, mockNudgedPlayerId, mockTurnId, mockGameId);

				// Assert
				expect(createNotification).toHaveBeenCalledWith(
					expect.objectContaining({
						templateData: expect.objectContaining({
							waitTime: testCase.expected
						})
					})
				);

				vi.clearAllMocks();
			}
		});
	});

	describe('getTurnNudgeStats', () => {
		it('should return correct nudge statistics', async () => {
			// Arrange
			const mockTurn = { playerId: mockNudgedPlayerId };
			const mockNudge = { createdAt: new Date() };

			(prisma.turn.findUnique as any).mockResolvedValue(mockTurn);
			(prisma.notification.count as any).mockResolvedValue(3);
			(prisma.notification.findFirst as any)
				.mockResolvedValueOnce(null) // Cooldown check
				.mockResolvedValueOnce(mockNudge); // Last nudge

			// Act
			const result = await getTurnNudgeStats(mockTurnId);

			// Assert
			expect(result).toEqual({
				totalNudges: 3,
				lastNudgeAt: mockNudge.createdAt,
				canReceiveNudge: true,
				cooldownRemainingHours: undefined
			});
		});

		it('should handle missing turn', async () => {
			// Arrange
			(prisma.turn.findUnique as any).mockResolvedValue(null);

			// Act
			const result = await getTurnNudgeStats(mockTurnId);

			// Assert
			expect(result).toEqual({
				totalNudges: 0,
				canReceiveNudge: false
			});
		});

		it('should respect cooldown period', async () => {
			// Arrange
			const mockTurn = { playerId: mockNudgedPlayerId };
			const recentNudge = {
				createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
			};

			(prisma.turn.findUnique as any).mockResolvedValue(mockTurn);
			(prisma.notification.count as any).mockResolvedValue(1);
			(prisma.notification.findFirst as any)
				.mockResolvedValueOnce(recentNudge) // Cooldown check
				.mockResolvedValueOnce(recentNudge); // Last nudge

			// Act
			const result = await getTurnNudgeStats(mockTurnId);

			// Assert
			expect(result.canReceiveNudge).toBe(false);
			expect(result.cooldownRemainingHours).toBe(18); // 24 - 6 = 18
		});
	});
});
