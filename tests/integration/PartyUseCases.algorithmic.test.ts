import { describe, it, expect } from 'vitest';
import { assignNextTurnAlgorithmic } from '$lib/server/logic/turnAssignment';
import { generateSquare } from '$lib/utils/williamsSquare';
import type { GameWithTurns, Turn } from '$lib/types/domain';

// Helper to create mock game
const createMockGame = (
	gameId: string,
	turns: Array<{
		playerId: string;
		isDrawing: boolean;
		completedAt: Date | null;
		orderIndex: number;
	}>
): GameWithTurns => ({
	id: gameId,
	createdAt: new Date(),
	updatedAt: new Date(),
	completedAt: null,
	deletedAt: null,
	expiresAt: new Date(),
	completedCount: 0,
	favoritesCount: 0,
	config: {
		minTurns: 10,
		maxTurns: 10,
		writingTimeout: '2d',
		drawingTimeout: '2d',
		gameTimeout: '365d',
		isLewd: false
	},
	seasonId: 'test-season',
	isLewd: false,
	turns: turns as Turn[]
});

const createMockTurn = (playerId: string, isDrawing: boolean, orderIndex: number = 0): Turn => ({
	id: `turn-${playerId}-${orderIndex}`,
	createdAt: new Date(),
	updatedAt: new Date(),
	expiresAt: new Date(),
	completedAt: new Date(),
	status: 'completed',
	gameId: 'test-game',
	playerId,
	content: isDrawing ? '<svg>test</svg>' : 'test content',
	isDrawing,
	orderIndex,
	rejectedAt: null,
	flags: []
});

// String to seed function (same as in PartyUseCases)
function stringToSeed(s: string): number {
	let hash = 0;
	for (let i = 0; i < s.length; i++) {
		const char = s.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0; // Convert to 32bit integer
	}
	return Math.abs(hash);
}

describe('assignNextTurnAlgorithmic - Williams Square Algorithm', () => {
	const playerIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
	const seed = stringToSeed('test-season');
	const williamsSquare = generateSquare(10, seed);

	describe('Deterministic Williams Square assignment', () => {
		it('should follow Williams Square pattern for game progression', () => {
			// Test Game 0: A completes turn 0, next should be square[0][1]
			const game0 = createMockGame('game-0', [
				{ playerId: 'A', isDrawing: false, completedAt: new Date(), orderIndex: 0 }
			]);
			const completedTurn0 = createMockTurn('A', false, 0);

			const allPartyGames = [];
			for (let i = 0; i < 10; i++) {
				allPartyGames.push({
					id: `game-${i}`,
					turns: i === 0 ? [{ playerId: 'A', isDrawing: false, completedAt: new Date() }] : []
				});
			}

			const result = assignNextTurnAlgorithmic(
				{
					gameId: game0.id,
					seasonId: game0.seasonId,
					completedTurnPlayerId: completedTurn0.playerId,
					completedTurnOrderIndex: completedTurn0.orderIndex
				},
				playerIds,
				allPartyGames
			);
			expect(result.nextPlayerId).toBe(williamsSquare[0][1]); // Next player in Game 0 sequence
		});

		it('should follow Williams Square pattern for different games', () => {
			// Test Game 1: B completes turn 0, next should be square[1][1]
			const game1 = createMockGame('game-1', [
				{ playerId: 'B', isDrawing: false, completedAt: new Date(), orderIndex: 0 }
			]);
			const completedTurn1 = createMockTurn('B', false, 0);

			const allPartyGames = [];
			for (let i = 0; i < 10; i++) {
				allPartyGames.push({
					id: `game-${i}`,
					turns: i === 1 ? [{ playerId: 'B', isDrawing: false, completedAt: new Date() }] : []
				});
			}

			const result = assignNextTurnAlgorithmic(
				{
					gameId: game1.id,
					seasonId: game1.seasonId,
					completedTurnPlayerId: completedTurn1.playerId,
					completedTurnOrderIndex: completedTurn1.orderIndex
				},
				playerIds,
				allPartyGames
			);
			expect(result.nextPlayerId).toBe(williamsSquare[1][1]); // Next player in Game 1 sequence
		});

		it('should progress through turns in Williams Square sequence', () => {
			// Test Game 0: Progress through multiple turns
			const game0 = createMockGame('game-0', [
				{ playerId: 'A', isDrawing: false, completedAt: new Date(), orderIndex: 0 },
				{ playerId: williamsSquare[0][1], isDrawing: true, completedAt: new Date(), orderIndex: 1 }
			]);
			const completedTurn = createMockTurn(williamsSquare[0][1], true, 1);

			const allPartyGames = [
				{
					id: 'game-0',
					turns: [
						{ playerId: 'A', isDrawing: false, completedAt: new Date() },
						{ playerId: williamsSquare[0][1], isDrawing: true, completedAt: new Date() }
					]
				}
			];
			for (let i = 1; i < 10; i++) {
				allPartyGames.push({ id: `game-${i}`, turns: [] });
			}

			const result = assignNextTurnAlgorithmic(
				{
					gameId: game0.id,
					seasonId: game0.seasonId,
					completedTurnPlayerId: completedTurn.playerId,
					completedTurnOrderIndex: completedTurn.orderIndex
				},
				playerIds,
				allPartyGames
			);
			expect(result.nextPlayerId).toBe(williamsSquare[0][2]); // Third player in Game 0 sequence
		});

		it('should return null when game sequence is complete', () => {
			// Test Game 0: All 10 turns completed
			const completedTurns = [];
			for (let i = 0; i < 10; i++) {
				completedTurns.push({
					playerId: williamsSquare[0][i],
					isDrawing: i % 2 === 1,
					completedAt: new Date(),
					orderIndex: i
				});
			}

			const game0 = createMockGame('game-0', completedTurns);
			const lastTurn = createMockTurn(williamsSquare[0][9], false, 9);

			const allPartyGames = [
				{
					id: 'game-0',
					turns: completedTurns.map((t) => ({
						playerId: t.playerId,
						isDrawing: t.isDrawing,
						completedAt: t.completedAt
					}))
				}
			];
			for (let i = 1; i < 10; i++) {
				allPartyGames.push({ id: `game-${i}`, turns: [] });
			}

			const result = assignNextTurnAlgorithmic(
				{
					gameId: game0.id,
					seasonId: game0.seasonId,
					completedTurnPlayerId: lastTurn.playerId,
					completedTurnOrderIndex: lastTurn.orderIndex
				},
				playerIds,
				allPartyGames
			);
			expect(result.nextPlayerId).toBe(null); // Game sequence is complete
		});
	});

	describe('Fallback behavior', () => {
		it('should fall back to round-robin for 3 players', () => {
			const smallPlayerIds = ['A', 'B', 'C'];
			const game = createMockGame('game-0', [
				{ playerId: 'A', isDrawing: false, completedAt: new Date(), orderIndex: 0 }
			]);
			const completedTurn = createMockTurn('A', false, 0);

			const allPartyGames = [
				{ id: 'game-0', turns: [{ playerId: 'A', isDrawing: false, completedAt: new Date() }] }
			];

			const result = assignNextTurnAlgorithmic(
				{
					gameId: game.id,
					seasonId: game.seasonId,
					completedTurnPlayerId: completedTurn.playerId,
					completedTurnOrderIndex: completedTurn.orderIndex
				},
				smallPlayerIds,
				allPartyGames
			);
			expect(result.nextPlayerId).toBe('B'); // Round-robin: A -> B
		});

		it('should fall back to round-robin for more than 26 players', () => {
			// Create 27 players
			const largePlayerIds = Array.from({ length: 27 }, (_, i) => String.fromCharCode(65 + i));
			const game = createMockGame('game-0', [
				{ playerId: 'A', isDrawing: false, completedAt: new Date(), orderIndex: 0 }
			]);
			const completedTurn = createMockTurn('A', false, 0);

			const allPartyGames = [
				{ id: 'game-0', turns: [{ playerId: 'A', isDrawing: false, completedAt: new Date() }] }
			];

			const result = assignNextTurnAlgorithmic(
				{
					gameId: game.id,
					seasonId: game.seasonId,
					completedTurnPlayerId: completedTurn.playerId,
					completedTurnOrderIndex: completedTurn.orderIndex
				},
				largePlayerIds,
				allPartyGames
			);
			expect(result.nextPlayerId).toBe('B'); // Round-robin: A -> B
		});
	});

	describe('Williams Square properties', () => {
		it('should generate consistent results with same seed', () => {
			const square1 = generateSquare(10, seed);
			const square2 = generateSquare(10, seed);
			expect(square1).toEqual(square2); // Deterministic behavior
		});

		it('should have proper Latin Square properties', () => {
			const square = generateSquare(10, seed);

			// Each row should have all 10 letters exactly once
			for (let i = 0; i < 10; i++) {
				const row = square[i];
				const unique = [...new Set(row)];
				expect(unique).toHaveLength(10);
				expect(unique.sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
			}

			// Each column should have all 10 letters exactly once
			for (let j = 0; j < 10; j++) {
				const column = square.map((row) => row[j]);
				const unique = [...new Set(column)];
				expect(unique).toHaveLength(10);
				expect(unique.sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
			}
		});

		it('should start each game with the correct player', () => {
			const square = generateSquare(10, seed);

			// Game i should start with player at position i in alphabet
			for (let i = 0; i < 10; i++) {
				const expectedFirstPlayer = String.fromCharCode(65 + i); // A, B, C, ...
				expect(square[i][0]).toBe(expectedFirstPlayer);
			}
		});
	});
});
