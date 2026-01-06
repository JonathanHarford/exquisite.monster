import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameUseCases } from '../../../../src/lib/server/usecases/GameUseCases';

// Mock dependencies
vi.mock('../../../../src/lib/server/usecases/GameUseCases', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/lib/server/usecases/GameUseCases')>();
	// We want to test the actual method findStalestValidPendingTurn, but mock its internal calls
	// So we can't fully mock the class. We need to spy on the static methods.
	// However, spying on static methods of the same class being tested is tricky if they call each other.
	// GameUseCases calls this.findAllPendingTurnsByPlayerId and this.deleteTurnIfExpired.
	// Since they are static, we can spy on them if we don't mock the whole module.
	return {
		...actual
	};
});

describe('GameUseCases.findStalestValidPendingTurn', () => {
	const mockUserId = 'user-123';

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should return the first valid turn', async () => {
		const pendingTurns = [
			{ id: 'turn-1', createdAt: new Date() },
			{ id: 'turn-2', createdAt: new Date() }
		];

		// We need to spy on the methods we want to mock behavior for
		const findAllSpy = vi.spyOn(GameUseCases, 'findAllPendingTurnsByPlayerId')
			.mockResolvedValue(pendingTurns as any);
		
		const deleteSpy = vi.spyOn(GameUseCases, 'deleteTurnIfExpired')
			.mockResolvedValueOnce(false); // turn-1 is valid

		const result = await GameUseCases.findStalestValidPendingTurn(mockUserId);

		expect(result).toEqual(pendingTurns[0]);
		expect(findAllSpy).toHaveBeenCalledWith(mockUserId);
		expect(deleteSpy).toHaveBeenCalledWith('turn-1');
		expect(deleteSpy).toHaveBeenCalledTimes(1); // Should stop after first valid
	});

	it('should skip expired turns and return the next valid one', async () => {
		const pendingTurns = [
			{ id: 'turn-expired', createdAt: new Date() },
			{ id: 'turn-valid', createdAt: new Date() }
		];

		const findAllSpy = vi.spyOn(GameUseCases, 'findAllPendingTurnsByPlayerId')
			.mockResolvedValue(pendingTurns as any);

		const deleteSpy = vi.spyOn(GameUseCases, 'deleteTurnIfExpired')
			.mockResolvedValueOnce(true) // turn-expired is expired
			.mockResolvedValueOnce(false); // turn-valid is valid

		const result = await GameUseCases.findStalestValidPendingTurn(mockUserId);

		expect(result).toEqual(pendingTurns[1]);
		expect(deleteSpy).toHaveBeenCalledWith('turn-expired');
		expect(deleteSpy).toHaveBeenCalledWith('turn-valid');
	});

	it('should return null if all turns are expired', async () => {
		const pendingTurns = [
			{ id: 'turn-expired-1', createdAt: new Date() },
			{ id: 'turn-expired-2', createdAt: new Date() }
		];

		const findAllSpy = vi.spyOn(GameUseCases, 'findAllPendingTurnsByPlayerId')
			.mockResolvedValue(pendingTurns as any);

		const deleteSpy = vi.spyOn(GameUseCases, 'deleteTurnIfExpired')
			.mockResolvedValue(true);

		const result = await GameUseCases.findStalestValidPendingTurn(mockUserId);

		expect(result).toBeNull();
		expect(deleteSpy).toHaveBeenCalledTimes(2);
	});

	it('should return null if no pending turns exist', async () => {
		const pendingTurns: any[] = [];

		const findAllSpy = vi.spyOn(GameUseCases, 'findAllPendingTurnsByPlayerId')
			.mockResolvedValue(pendingTurns);

		const deleteSpy = vi.spyOn(GameUseCases, 'deleteTurnIfExpired');

		const result = await GameUseCases.findStalestValidPendingTurn(mockUserId);

		expect(result).toBeNull();
		expect(deleteSpy).not.toHaveBeenCalled();
	});
});