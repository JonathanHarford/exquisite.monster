import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TurnValidator } from '$lib/server/usecases/game/TurnValidator';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';

vi.mock('$lib/server/usecases/GameUseCases', () => {
    return {
        GameUseCases: {
            findGameByTurnId: vi.fn(),
        }
    };
});

describe('TurnValidator', () => {
    const mockUserId = 'user1';
    const mockTurnId = 'turn1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns success for valid turn', async () => {
        const mockTurn = { id: mockTurnId, playerId: mockUserId, status: 'pending' };
        const mockGame = { turns: [mockTurn] };

        vi.mocked(GameUseCases.findGameByTurnId).mockResolvedValue(mockGame as any);

        const result = await TurnValidator.validate(mockUserId, mockTurnId);

        expect(result).toEqual({
            success: true,
            game: mockGame,
            turn: mockTurn
        });
    });

    it('returns game_not_found if game does not exist', async () => {
        vi.mocked(GameUseCases.findGameByTurnId).mockResolvedValue(null);

        const result = await TurnValidator.validate(mockUserId, mockTurnId);

        expect(result).toEqual({ success: false, error: 'game_not_found' });
    });

    it('returns turn_not_found if turn is not in game', async () => {
        const mockGame = { turns: [] };
        vi.mocked(GameUseCases.findGameByTurnId).mockResolvedValue(mockGame as any);

        const result = await TurnValidator.validate(mockUserId, mockTurnId);

        expect(result).toEqual({ success: false, error: 'turn_not_found' });
    });

    it('returns not_your_turn if player does not own turn', async () => {
        const mockTurn = { id: mockTurnId, playerId: 'otherUser', status: 'pending' };
        const mockGame = { turns: [mockTurn] };
        vi.mocked(GameUseCases.findGameByTurnId).mockResolvedValue(mockGame as any);

        const result = await TurnValidator.validate(mockUserId, mockTurnId);

        expect(result).toEqual({
            success: false,
            error: 'not_your_turn',
            game: mockGame,
            turn: mockTurn
        });
    });

    it('returns turn_completed if turn is not pending', async () => {
        const mockTurn = { id: mockTurnId, playerId: mockUserId, status: 'completed' };
        const mockGame = { turns: [mockTurn] };
        vi.mocked(GameUseCases.findGameByTurnId).mockResolvedValue(mockGame as any);

        const result = await TurnValidator.validate(mockUserId, mockTurnId);

        expect(result).toEqual({
            success: false,
            error: 'turn_completed',
            game: mockGame,
            turn: mockTurn
        });
    });
});
