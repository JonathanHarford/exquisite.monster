import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as analyticsRemote from '$lib/server/remotes/analytics';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { prisma } from '$lib/server/prisma';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('$lib/server/usecases/AdminUseCases');
vi.mock('$lib/server/prisma', () => ({
	prisma: {
		player: {
			findUnique: vi.fn()
		}
	}
}));

describe('Analytics Remote Functions', () => {
	let mockEvent: RequestEvent;

	beforeEach(() => {
		vi.resetAllMocks();
		mockEvent = {
			locals: {
				auth: vi.fn().mockReturnValue({ userId: 'admin-123' })
			}
		} as unknown as RequestEvent;

		// Default to admin user
		vi.mocked(prisma.player.findUnique).mockResolvedValue({ isAdmin: true } as any);
	});

	describe('Access Control', () => {
		it('should throw forbidden if user is not admin', async () => {
			vi.mocked(prisma.player.findUnique).mockResolvedValue({ isAdmin: false } as any);

			await expect(analyticsRemote.getSiteAnalyticsLogic(mockEvent)).rejects.toThrow('Forbidden');
		});

		it('should throw forbidden if user is not logged in', async () => {
			mockEvent.locals.auth = vi.fn().mockReturnValue({ userId: null });

			await expect(analyticsRemote.getSiteAnalyticsLogic(mockEvent)).rejects.toThrow('Forbidden');
		});
	});

	describe('getSiteAnalytics', () => {
		it('should return site analytics', async () => {
			const mockData = { totalGames: 10 };
			vi.mocked(AdminUseCases.getSiteAnalytics).mockResolvedValue(mockData as any);

			const result = await analyticsRemote.getSiteAnalyticsLogic(mockEvent);
			expect(result).toEqual(mockData);
		});
	});

	describe('getAllAnalytics', () => {
		it('should aggregate all analytics', async () => {
			vi.mocked(AdminUseCases.getSiteAnalytics).mockResolvedValue({ site: 1 } as any);
			vi.mocked(AdminUseCases.getDailyAnalytics).mockResolvedValue({ daily: 1 } as any);
			vi.mocked(AdminUseCases.getTopPlayers).mockResolvedValue({ players: 1 } as any);
			vi.mocked(AdminUseCases.getGameAnalytics).mockResolvedValue({ games: 1 } as any);
			vi.mocked(AdminUseCases.getFlagAnalytics).mockResolvedValue({ flags: 1 } as any);

			const result = await analyticsRemote.getAllAnalyticsLogic(mockEvent, 7);

			expect(result).toMatchObject({
				site: { site: 1 },
				daily: { daily: 1 },
				players: { players: 1 },
				games: { games: 1 },
				flags: { flags: 1 }
			});
			expect(AdminUseCases.getDailyAnalytics).toHaveBeenCalledWith(7);
		});
	});
});
