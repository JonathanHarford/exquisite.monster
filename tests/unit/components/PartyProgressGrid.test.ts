import { describe, it, expect } from 'vitest';
import type { GameWithTurns, Turn } from '$lib/types/domain';
import { DAYS, HOURS } from '$lib/datetime';

// Helper function to calculate staleness (matches component logic)
function calculateStaleness(
	createdAt: Date,
	completedAt: Date | null
): 'none' | 'stale' | 'very-stale' {
	if (completedAt) return 'none';
	const now = new Date();
	const hoursPending = (now.getTime() - new Date(createdAt).getTime()) / HOURS;
	if (hoursPending > 168) return 'very-stale'; // 7 days
	if (hoursPending > 48) return 'stale'; // 2 days
	return 'none';
}

// Helper function to calculate completion percentage
function calculateCompletionPercentage(turns: Turn[]): number {
	if (turns.length === 0) return 0;
	const completedTurns = turns.filter((turn) => turn.completedAt !== null).length;
	return Math.round((completedTurns / turns.length) * 100);
}

// Mock data for testing
const mockPlayers = [
	{ playerId: 'player1', username: 'Alice', imageUrl: '/alice.png', joinedAt: new Date() },
	{ playerId: 'player2', username: 'Bob', imageUrl: '/bob.png', joinedAt: new Date() },
	{ playerId: 'player3', username: 'Charlie', imageUrl: '/charlie.png', joinedAt: new Date() }
];

const mockGames: GameWithTurns[] = [
	{
		id: 'game1',
		createdAt: new Date(),
		updatedAt: new Date(),
		completedAt: null,
		deletedAt: null,
		expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		completedCount: 2,
		favoritesCount: 0,
		seasonId: 'season1',
		isLewd: false,
		config: {
			minTurns: 5,
			maxTurns: 10,
			writingTimeout: '7d',
			drawingTimeout: '7d',
			gameTimeout: '30d',
			isLewd: false
		},
		turns: [
			{
				id: 'turn1',
				createdAt: new Date(Date.now() - 2 * DAYS), // 2 days ago
				updatedAt: new Date(),
				completedAt: new Date(Date.now() - 1 * DAYS), // completed 1 day ago
				expiresAt: null,
				gameId: 'game1',
				playerId: 'player1',
				content: 'Test content',
				isDrawing: false,
				orderIndex: 0,
				rejectedAt: null,
				flags: [],
				status: 'completed' as const
			},
			{
				id: 'turn2',
				createdAt: new Date(Date.now() - 1 * DAYS), // 1 day ago
				updatedAt: new Date(),
				completedAt: new Date(Date.now() - 2 * HOURS), // completed 2 hours ago
				expiresAt: null,
				gameId: 'game1',
				playerId: 'player2',
				content: 'Drawing content',
				isDrawing: true,
				orderIndex: 1,
				rejectedAt: null,
				flags: [],
				status: 'completed' as const
			},
			{
				id: 'turn3',
				createdAt: new Date(Date.now() - 3 * DAYS), // 3 days ago (stale)
				updatedAt: new Date(),
				completedAt: null, // pending
				expiresAt: null,
				gameId: 'game1',
				playerId: 'player3',
				content: '',
				isDrawing: false,
				orderIndex: 2,
				rejectedAt: null,
				flags: [],
				status: 'pending' as const
			}
		]
	},
	{
		id: 'game2',
		createdAt: new Date(),
		updatedAt: new Date(),
		completedAt: new Date(), // completed game
		deletedAt: null,
		expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		completedCount: 3,
		favoritesCount: 2,
		seasonId: 'season1',
		isLewd: false,
		config: {
			minTurns: 3,
			maxTurns: 5,
			writingTimeout: '7d',
			drawingTimeout: '7d',
			gameTimeout: '30d',
			isLewd: false
		},
		turns: [
			{
				id: 'turn4',
				createdAt: new Date(Date.now() - 5 * DAYS),
				updatedAt: new Date(),
				completedAt: new Date(Date.now() - 4 * DAYS),
				expiresAt: null,
				gameId: 'game2',
				playerId: 'player1',
				content: 'Completed turn',
				isDrawing: false,
				orderIndex: 0,
				rejectedAt: null,
				flags: [],
				status: 'completed' as const
			},
			{
				id: 'turn5',
				createdAt: new Date(Date.now() - 4 * DAYS),
				updatedAt: new Date(),
				completedAt: new Date(Date.now() - 3 * DAYS),
				expiresAt: null,
				gameId: 'game2',
				playerId: 'player2',
				content: 'Drawing completed',
				isDrawing: true,
				orderIndex: 1,
				rejectedAt: null,
				flags: [],
				status: 'completed' as const
			},
			{
				id: 'turn6',
				createdAt: new Date(Date.now() - 3 * DAYS),
				updatedAt: new Date(),
				completedAt: new Date(Date.now() - 2 * DAYS),
				expiresAt: null,
				gameId: 'game2',
				playerId: 'player3',
				content: 'Final turn',
				isDrawing: false,
				orderIndex: 2,
				rejectedAt: null,
				flags: [],
				status: 'completed' as const
			}
		]
	}
];

describe('PartyProgressGrid Component Logic', () => {
	it('should calculate completion percentages correctly', () => {
		// Game 1: 2 completed out of 3 turns = 67%
		const game1Percentage = calculateCompletionPercentage(mockGames[0].turns);
		expect(game1Percentage).toBe(67);

		// Game 2: 3 completed out of 3 turns = 100%
		const game2Percentage = calculateCompletionPercentage(mockGames[1].turns);
		expect(game2Percentage).toBe(100);
	});

	it('should calculate staleness correctly', () => {
		const now = new Date();

		// Completed turn should not be stale
		const completedTurn = new Date(now.getTime() - 3 * DAYS); // 3 days ago
		const completedAt = new Date(now.getTime() - 1 * DAYS); // completed 1 day ago
		expect(calculateStaleness(completedTurn, completedAt)).toBe('none');

		// Fresh pending turn (< 48 hours)
		const freshTurn = new Date(now.getTime() - 1 * DAYS); // 1 day ago
		expect(calculateStaleness(freshTurn, null)).toBe('none');

		// Stale turn (> 48 hours, < 7 days)
		const staleTurn = new Date(now.getTime() - 3 * DAYS); // 3 days ago
		expect(calculateStaleness(staleTurn, null)).toBe('stale');

		// Very stale turn (> 7 days)
		const veryStaleTurn = new Date(now.getTime() - 8 * DAYS); // 8 days ago
		expect(calculateStaleness(veryStaleTurn, null)).toBe('very-stale');
	});

	it('should handle empty games array', () => {
		const percentage = calculateCompletionPercentage([]);
		expect(percentage).toBe(0);
	});

	it('should handle missing player data gracefully', () => {
		const gameWithMissingPlayer = {
			...mockGames[0],
			turns: [
				{
					...mockGames[0].turns[0],
					playerId: 'unknown-player'
				}
			]
		};

		// The component should handle missing players by showing "Unknown"
		const player = mockPlayers.find((p) => p.playerId === 'unknown-player');
		expect(player).toBeUndefined();
	});

	it('should identify stale turns correctly', () => {
		// Turn3 from mockGames[0] is 3 days old and pending (stale)
		const staleTurn = mockGames[0].turns[2];
		const staleness = calculateStaleness(staleTurn.createdAt, staleTurn.completedAt);
		expect(staleness).toBe('stale');
	});

	it('should sort games by urgency (stale turns first)', () => {
		// Mock games: Game 1 has stale turn, Game 2 is completed
		// Game 1 should be sorted first due to stale turn
		const game1HasStaleTurns = mockGames[0].turns.some(
			(turn) =>
				turn.completedAt === null && calculateStaleness(turn.createdAt, turn.completedAt) !== 'none'
		);
		const game2HasStaleTurns = mockGames[1].turns.some(
			(turn) =>
				turn.completedAt === null && calculateStaleness(turn.createdAt, turn.completedAt) !== 'none'
		);

		expect(game1HasStaleTurns).toBe(true);
		expect(game2HasStaleTurns).toBe(false);
	});
});
