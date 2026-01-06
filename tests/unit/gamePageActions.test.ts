import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { actions } from '../../src/routes/g/[gameId]/+page.server';
import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/services/playerService';

// Mock dependencies
vi.mock('$lib/server/usecases/GameUseCases', () => ({
	GameUseCases: {
		deleteGame: vi.fn()
	}
}));
vi.mock('$lib/server/services/playerService', () => ({
	isAdmin: vi.fn()
}));
vi.mock('@sveltejs/kit', async () => {
	const actual = await vi.importActual('@sveltejs/kit');
	return {
		...actual,
		redirect: vi.fn(),
		fail: vi.fn()
	};
});

describe('Admin Game Actions', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('killGame action', () => {
		it('should successfully delete a game and redirect', async () => {
			// Arrange
			vi.mocked(isAdmin).mockResolvedValue(true);
			vi.mocked(GameUseCases.deleteGame).mockResolvedValue(undefined);
			const mockRedirect = vi.mocked(redirect).mockImplementation(() => {
				throw new Error('Redirected');
			});

			const mockEvent: Partial<RequestEvent> = {
				request: new Request('http://localhost', { method: 'POST' }),
				params: { gameId: 'test-game-id' },
				locals: { auth: () => ({ userId: 'admin-user-id' }) } as any
			};

			// Act & Assert
			await expect(actions.killGame(mockEvent as any)).rejects.toThrow('Redirected');
			expect(isAdmin).toHaveBeenCalledWith('admin-user-id');
			expect(GameUseCases.deleteGame).toHaveBeenCalledWith('test-game-id');
			expect(mockRedirect).toHaveBeenCalledWith(302, '/admin/games');
		});

		it('should return error if not admin', async () => {
			// Arrange
			vi.mocked(isAdmin).mockResolvedValue(false);
			const mockFail = vi.mocked(fail);

			const mockEvent: Partial<RequestEvent> = {
				request: new Request('http://localhost', { method: 'POST' }),
				params: { gameId: 'test-game-id' },
				locals: { auth: () => ({ userId: 'non-admin-user-id' }) } as any
			};

			// Act
			await actions.killGame(mockEvent as any);

			// Assert
			expect(isAdmin).toHaveBeenCalledWith('non-admin-user-id');
			expect(mockFail).toHaveBeenCalledWith(403, {
				message: 'You are not authorized to perform this action'
			});
		});

		it('should return error if gameId is missing', async () => {
			// Arrange
			vi.mocked(isAdmin).mockResolvedValue(true);
			const mockFail = vi.mocked(fail);

			const mockEvent: Partial<RequestEvent> = {
				request: new Request('http://localhost', { method: 'POST' }),
				params: {},
				locals: { auth: () => ({ userId: 'admin-user-id' }) } as any
			};

			// Act
			await actions.killGame(mockEvent as any);

			// Assert
			expect(isAdmin).toHaveBeenCalledWith('admin-user-id');
			expect(mockFail).toHaveBeenCalledWith(400, { message: 'Game ID is required' });
		});

		it('should handle deletion errors', async () => {
			// Arrange
			vi.mocked(isAdmin).mockResolvedValue(true);
			vi.mocked(GameUseCases.deleteGame).mockRejectedValue(new Error('Database error'));
			const mockFail = vi.mocked(fail);

			const mockEvent: Partial<RequestEvent> = {
				request: new Request('http://localhost', { method: 'POST' }),
				params: { gameId: 'test-game-id' },
				locals: { auth: () => ({ userId: 'admin-user-id' }) } as any
			};

			// Act
			await actions.killGame(mockEvent as any);

			// Assert
			expect(isAdmin).toHaveBeenCalledWith('admin-user-id');
			expect(mockFail).toHaveBeenCalledWith(500, { message: 'Failed to kill game' });
		});
	});
});
