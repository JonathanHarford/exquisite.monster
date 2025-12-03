import { describe, it, expect } from 'vitest';
import {
    stringToSeed,
    assignNextTurnRoundRobin,
    assignNextTurnAlgorithmic,
    type TurnContext,
    type GameTurnInfo
} from '$lib/server/logic/turnAssignment';

describe('Turn Assignment Logic', () => {
    describe('stringToSeed', () => {
        it('should return consistent seed for same string', () => {
            const seed1 = stringToSeed('test-string');
            const seed2 = stringToSeed('test-string');
            expect(seed1).toBe(seed2);
        });

        it('should return different seeds for different strings', () => {
            const seed1 = stringToSeed('string-1');
            const seed2 = stringToSeed('string-2');
            expect(seed1).not.toBe(seed2);
        });
    });

    describe('assignNextTurnRoundRobin', () => {
        const playerIds = ['p1', 'p2', 'p3'];

        it('should assign next player in sequence', () => {
            const result = assignNextTurnRoundRobin('g1', 'p1', playerIds);
            expect(result.nextPlayerId).toBe('p2');
            expect(result.error).toBeUndefined();
        });

        it('should wrap around to first player', () => {
            const result = assignNextTurnRoundRobin('g1', 'p3', playerIds);
            expect(result.nextPlayerId).toBe('p1');
        });

        it('should return error if completed turn player is not in list', () => {
            const result = assignNextTurnRoundRobin('g1', 'unknown', playerIds);
            expect(result.nextPlayerId).toBeNull();
            expect(result.error).toBeDefined();
        });
    });

    describe('assignNextTurnAlgorithmic', () => {
        const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']; // n=6 > 3
        const mockGame: TurnContext = {
            gameId: 'g1',
            seasonId: 's1',
            completedTurnPlayerId: 'p1',
            completedTurnOrderIndex: 0
        };
        const mockAllPartyGames: GameTurnInfo[] = [
            { id: 'g1', turns: [] },
            { id: 'g2', turns: [] }
        ];

        it('should fallback to round robin if n <= 3', () => {
            const smallPlayerList = ['p1', 'p2', 'p3'];
            const result = assignNextTurnAlgorithmic(mockGame, smallPlayerList, mockAllPartyGames);
            // Expected RR behavior: p1 -> p2
            expect(result.nextPlayerId).toBe('p2');
        });

        it('should return error if seasonId is missing', () => {
            const result = assignNextTurnAlgorithmic({ ...mockGame, seasonId: null }, playerIds, mockAllPartyGames);
            expect(result.error).toBe('Season ID is required for algorithmic assignment');
        });

        it('should return log/fallback if game not found in party games', () => {
            const result = assignNextTurnAlgorithmic(mockGame, playerIds, []);
            expect(result.log).toContain('not found in allPartyGames');
            // Fallback RR: p1 -> p2
            expect(result.nextPlayerId).toBe('p2');
        });

        it('should assign next player based on Williams Square', () => {
            // We are mocking enough context. The exact next player depends on the seed.
            // But we can check it returns a valid player from the list.
            const result = assignNextTurnAlgorithmic(mockGame, playerIds, mockAllPartyGames);
            expect(playerIds).toContain(result.nextPlayerId);
        });
    });
});
