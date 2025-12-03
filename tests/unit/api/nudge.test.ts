import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../../src/routes/api/parties/[id]/nudge/+server';
import { nudgePlayer } from '$lib/server/services/nudgeService';

// Mock dependencies
vi.mock('$lib/server/services/nudgeService', () => ({
	nudgePlayer: vi.fn()
}));

vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn()
	}
}));

describe('/api/parties/[id]/nudge API endpoint', () => {
	const mockUserId = 'user-123';
	const mockPartyId = 'party-456';
	const mockTurnId = 'turn-789';
	const mockGameId = 'game-abc';
	const mockPlayerId = 'player-def';

	beforeEach(() => {
		vi.clearAllMocks();
	});

	interface NudgeRequestBody {
		turnId?: string;
		gameId?: string;
		playerId?: string;
	}

	const createMockRequest = (body: NudgeRequestBody) => ({
		json: vi.fn().mockResolvedValue(body)
	});

	const createMockLocals = (userId: string | null = mockUserId) => ({
		auth: vi.fn().mockReturnValue(userId ? { userId } : null)
	});

	it('should successfully send nudge with valid request', async () => {
		// Arrange
		const mockRequest = createMockRequest({
			turnId: mockTurnId,
			gameId: mockGameId,
			playerId: mockPlayerId
		});
		const mockLocals = createMockLocals();
		const mockParams = { id: mockPartyId };

		(nudgePlayer as any).mockResolvedValue({
			success: true,
			message: 'Nudge sent to TestPlayer'
		});

		// Act
		const response = await POST({
			request: mockRequest,
			params: mockParams,
			locals: mockLocals
		} as any);

		// Assert
		expect(nudgePlayer).toHaveBeenCalledWith(mockUserId, mockPlayerId, mockTurnId, mockGameId);

		const responseData = await response.json();
		expect(response.status).toBe(200);
		expect(responseData).toEqual({
			success: true,
			message: 'Nudge sent to TestPlayer'
		});
	});

	it('should return 401 when user is not authenticated', async () => {
		// Arrange
		const mockRequest = createMockRequest({
			turnId: mockTurnId,
			gameId: mockGameId,
			playerId: mockPlayerId
		});
		const mockLocals = createMockLocals(null); // No user ID
		const mockParams = { id: mockPartyId };

		// Act & Assert
		await expect(
			POST({
				request: mockRequest,
				params: mockParams,
				locals: mockLocals
			} as any)
		).rejects.toMatchObject({
			status: 401
		});

		expect(nudgePlayer).not.toHaveBeenCalled();
	});

	it('should return 400 when required fields are missing', async () => {
		// Test cases for missing fields
		const testCases = [
			{ turnId: undefined, gameId: mockGameId, playerId: mockPlayerId },
			{ turnId: mockTurnId, gameId: undefined, playerId: mockPlayerId },
			{ turnId: mockTurnId, gameId: mockGameId, playerId: undefined },
			{}
		];

		for (const requestBody of testCases) {
			// Arrange
			const mockRequest = createMockRequest(requestBody);
			const mockLocals = createMockLocals();
			const mockParams = { id: mockPartyId };

			// Act & Assert
			await expect(
				POST({
					request: mockRequest,
					params: mockParams,
					locals: mockLocals
				} as any)
			).rejects.toMatchObject({
				status: 400
			});

			expect(nudgePlayer).not.toHaveBeenCalled();
			vi.clearAllMocks();
		}
	});

	it('should return 429 when nudge is on cooldown', async () => {
		// Arrange
		const mockRequest = createMockRequest({
			turnId: mockTurnId,
			gameId: mockGameId,
			playerId: mockPlayerId
		});
		const mockLocals = createMockLocals();
		const mockParams = { id: mockPartyId };

		(nudgePlayer as any).mockResolvedValue({
			success: false,
			message: 'Nudge is on cooldown',
			cooldownRemainingHours: 12
		});

		// Act & Assert
		await expect(
			POST({
				request: mockRequest,
				params: mockParams,
				locals: mockLocals
			} as any)
		).rejects.toMatchObject({
			status: 429
		});
	});

	it('should return 400 for other nudge service failures', async () => {
		// Arrange
		const mockRequest = createMockRequest({
			turnId: mockTurnId,
			gameId: mockGameId,
			playerId: mockPlayerId
		});
		const mockLocals = createMockLocals();
		const mockParams = { id: mockPartyId };

		(nudgePlayer as any).mockResolvedValue({
			success: false,
			message: 'Player not found'
		});

		// Act & Assert
		await expect(
			POST({
				request: mockRequest,
				params: mockParams,
				locals: mockLocals
			} as any)
		).rejects.toMatchObject({
			status: 400
		});
	});

	it('should return 500 when nudge service throws unexpected error', async () => {
		// Arrange
		const mockRequest = createMockRequest({
			turnId: mockTurnId,
			gameId: mockGameId,
			playerId: mockPlayerId
		});
		const mockLocals = createMockLocals();
		const mockParams = { id: mockPartyId };

		(nudgePlayer as any).mockRejectedValue(new Error('Unexpected database error'));

		// Act & Assert
		await expect(
			POST({
				request: mockRequest,
				params: mockParams,
				locals: mockLocals
			} as any)
		).rejects.toMatchObject({
			status: 500
		});
	});

	it('should handle JSON parsing errors gracefully', async () => {
		// Arrange
		const mockRequest = {
			json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
		};
		const mockLocals = createMockLocals();
		const mockParams = { id: mockPartyId };

		// Act & Assert
		await expect(
			POST({
				request: mockRequest,
				params: mockParams,
				locals: mockLocals
			} as any)
		).rejects.toMatchObject({
			status: 500
		});

		expect(nudgePlayer).not.toHaveBeenCalled();
	});
});
