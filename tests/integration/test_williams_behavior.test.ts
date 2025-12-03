import { describe, it, expect } from 'vitest';
import { generateSquare } from '$lib/utils/williamsSquare';
import { assignNextTurnAlgorithmic } from '$lib/server/logic/turnAssignment';
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
	turns: turns.map((turn, index) => createMockTurn(turn.playerId, turn.isDrawing, index))
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

describe('Williams Square Behavior Analysis', () => {
	it('should understand Williams Square pattern for 10 players', () => {
		const n = 10;
		const seed = 12345;
		const square = generateSquare(n, seed);

		// Store the pattern for analysis
		const patterns = [];
		for (let i = 0; i < n; i++) {
			patterns.push(`Game ${i}: ${square[i].join(' -> ')}`);
		}

		expect(square).toHaveLength(10);
		expect(square[0]).toHaveLength(10);
		expect(square[0][0]).toBe('A'); // First game starts with player A

		// Log some key patterns for reference
		expect(square[0][1]).toBeDefined(); // Game 0, position 1
		expect(square[1][1]).toBeDefined(); // Game 1, position 1
	});

	it('should test actual algorithmic assignment behavior', () => {
		const playerIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

		// Test Game 0: First turn completed by A, what's next?
		const game0 = createMockGame('game-0', [
			{ playerId: 'A', isDrawing: false, completedAt: new Date(), orderIndex: 0 }
		]);
		const completedTurn0 = createMockTurn('A', false, 0);

		// All party games (10 games total, game 0 is the first one)
		const allPartyGames = [];
		for (let i = 0; i < 10; i++) {
			allPartyGames.push({
				id: `game-${i}`,
				turns: i === 0 ? [{ playerId: 'A', isDrawing: false, completedAt: new Date() }] : []
			});
		}

		const result0 = assignNextTurnAlgorithmic(
			{
				gameId: game0.id,
				seasonId: game0.seasonId,
				completedTurnPlayerId: completedTurn0.playerId,
				completedTurnOrderIndex: completedTurn0.orderIndex
			},
			playerIds,
			allPartyGames
		);

		// Test Game 1: First turn completed by B, what's next?
		const game1 = createMockGame('game-1', [
			{ playerId: 'B', isDrawing: false, completedAt: new Date(), orderIndex: 0 }
		]);
		const completedTurn1 = createMockTurn('B', false, 0);

		const allPartyGames1 = [];
		for (let i = 0; i < 10; i++) {
			allPartyGames1.push({
				id: `game-${i}`,
				turns: i === 1 ? [{ playerId: 'B', isDrawing: false, completedAt: new Date() }] : []
			});
		}

		const result1 = assignNextTurnAlgorithmic(
			{
				gameId: game1.id,
				seasonId: game1.seasonId,
				completedTurnPlayerId: completedTurn1.playerId,
				completedTurnOrderIndex: completedTurn1.orderIndex
			},
			playerIds,
			allPartyGames1
		);

		// Generate the square to understand expected results
		// Use the same seed generation logic as assignNextTurnAlgorithmic
		function stringToSeed(s: string): number {
			let hash = 0;
			for (let i = 0; i < s.length; i++) {
				const char = s.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash |= 0; // Convert to 32bit integer
			}
			return Math.abs(hash);
		}
		const seed = stringToSeed('test-season');
		const square = generateSquare(10, seed);

		// These should be deterministic based on the Williams Square
		// Game 0 (index 0), turn 1 (index 1) should be square[0][1]
		// Game 1 (index 1), turn 1 (index 1) should be square[1][1]
		expect(result0.nextPlayerId).toBe(square[0][1]);
		expect(result1.nextPlayerId).toBe(square[1][1]);
	});
});
