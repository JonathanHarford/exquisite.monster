import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nudgePlayerLogic } from '$lib/server/remotes/nudge';
import * as nudgeService from '$lib/server/services/nudgeService';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('$lib/server/services/nudgeService', () => ({
	nudgePlayer: vi.fn()
}));

vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn()
	}
}));

describe('Nudge Remote Function', () => {
	let mockEvent: RequestEvent;

	beforeEach(() => {
		vi.resetAllMocks();
		mockEvent = {
			locals: {
				auth: vi.fn().mockReturnValue({ userId: 'user-123' })
			}
		} as unknown as RequestEvent;
	});

	it('should send nudge successfully', async () => {
		vi.mocked(nudgeService.nudgePlayer).mockResolvedValue({
			success: true,
			message: 'Nudge sent'
		});

		const result = await nudgePlayerLogic(mockEvent, 'game-1', 'player-2', 'turn-1');

		expect(result).toEqual({ success: true, message: 'Nudge sent' });
		expect(nudgeService.nudgePlayer).toHaveBeenCalledWith('user-123', 'player-2', 'turn-1', 'game-1');
	});

	it('should throw error if unauthorized', async () => {
		mockEvent.locals.auth = vi.fn().mockReturnValue({ userId: null });

		await expect(nudgePlayerLogic(mockEvent, 'game-1', 'player-2', 'turn-1')).rejects.toThrow('Unauthorized');
	});

	it('should throw error if missing fields', async () => {
		await expect(nudgePlayerLogic(mockEvent, '', 'player-2', 'turn-1')).rejects.toThrow('Missing required fields');
	});

	it('should throw error if nudge service returns failure', async () => {
		vi.mocked(nudgeService.nudgePlayer).mockResolvedValue({
			success: false,
			message: 'Cannot nudge'
		});

		await expect(nudgePlayerLogic(mockEvent, 'game-1', 'player-2', 'turn-1')).rejects.toThrow('Cannot nudge');
	});
});
