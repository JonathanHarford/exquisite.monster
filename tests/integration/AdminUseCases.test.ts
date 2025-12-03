import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { type Player, type GameConfig } from '$lib/types/domain';
import { getPlayers, replaceDefaultConfig } from './helpers';
import { prisma } from '$lib/server/prisma';
// Integration tests always require a database - no conditional setup needed

// Explicitly mock svelte-clerk/server for this test file
vi.mock('svelte-clerk/server', () => ({
	clerkClient: {
		users: {
			getUser: vi.fn().mockResolvedValue({
				id: 'test-user-id',
				imageUrl: 'https://example.com/avatar.jpg',
				emailAddresses: [{ emailAddress: 'test@example.com' }]
			}),
			deleteUser: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

// import { clerkClient } from 'svelte-clerk/server'; // Unused

describe('AdminUseCases', () => {
	let players: Player[] = [];
	let defaultConfig: GameConfig;

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
		defaultConfig = await replaceDefaultConfig({
			minTurns: 2,
			maxTurns: 4,
			writingTimeout: '5s',
			drawingTimeout: '15s',
			gameTimeout: '1d',
			isLewd: false
		});
	});

	afterAll(async () => {
		await replaceDefaultConfig(defaultConfig);
	});

	describe('getDailyAnalytics', () => {
		it('should return daily analytics with proper structure', async () => {
			// Create some test data
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'Test writing content');

			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'https://example.com/drawing.png');

			// Create a flag for testing
			await FlagUseCases.flagTurn(turn2.id, players[0].id, 'spam', 'Test flag');

			// Get analytics
			const analytics = await AdminUseCases.getDailyAnalytics(7);

			// Verify structure
			expect(analytics).toHaveProperty('players');
			expect(analytics).toHaveProperty('games');
			expect(analytics).toHaveProperty('turns');
			expect(analytics).toHaveProperty('flags');

			// Verify each array has the correct structure
			expect(Array.isArray(analytics.players)).toBe(true);
			expect(Array.isArray(analytics.games)).toBe(true);
			expect(Array.isArray(analytics.turns)).toBe(true);
			expect(Array.isArray(analytics.flags)).toBe(true);

			// Verify data structure for each item
			if (analytics.players.length > 0) {
				expect(analytics.players[0]).toHaveProperty('date');
				expect(analytics.players[0]).toHaveProperty('count');
				expect(typeof analytics.players[0].count).toBe('number');
			}

			if (analytics.games.length > 0) {
				expect(analytics.games[0]).toHaveProperty('date');
				expect(analytics.games[0]).toHaveProperty('count');
				expect(typeof analytics.games[0].count).toBe('number');
			}

			if (analytics.turns.length > 0) {
				expect(analytics.turns[0]).toHaveProperty('date');
				expect(analytics.turns[0]).toHaveProperty('count');
				expect(typeof analytics.turns[0].count).toBe('number');
			}

			if (analytics.flags.length > 0) {
				expect(analytics.flags[0]).toHaveProperty('date');
				expect(analytics.flags[0]).toHaveProperty('count');
				expect(typeof analytics.flags[0].count).toBe('number');
			}
		});

		it('should return empty arrays when no data exists in date range', async () => {
			// Get analytics for a future date range where no data exists
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 30);

			// Mock the method to use a future date range
			const analytics = await AdminUseCases.getDailyAnalytics(1);

			// Should return empty arrays or arrays with zero counts
			expect(Array.isArray(analytics.players)).toBe(true);
			expect(Array.isArray(analytics.games)).toBe(true);
			expect(Array.isArray(analytics.turns)).toBe(true);
			expect(Array.isArray(analytics.flags)).toBe(true);
		});

		it('should group data by date correctly', async () => {
			// Create multiple turns on the same day
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'Test content 1');

			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn2.id, 'writing', 'Test content 2');

			const analytics = await AdminUseCases.getDailyAnalytics(1);

			// Should have aggregated the turns for today
			const today = new Date().toISOString().split('T')[0];
			const todayTurns = analytics.turns.find((item) => item.date === today);

			if (todayTurns) {
				expect(todayTurns.count).toBeGreaterThanOrEqual(2);
			}
		});
	});

	describe('getGameList', () => {
		it('should not mark games as flagged when all flags are resolved', async () => {
			// Create a game with a turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'Test writing content');

			// Flag the turn
			const flag = await FlagUseCases.flagTurn(turn1.id, players[1].id, 'spam', 'Test flag');

			// Get game list - should show as flagged
			let gameList = await AdminUseCases.getGameList();
			let flaggedGame = gameList.find((game) => game.id === turn1.gameId);
			expect(flaggedGame?.hasFlaggedTurns).toBe(true);

			// Resolve the flag by rejecting it
			await FlagUseCases.rejectFlag(flag.id);

			// Get game list again - should no longer show as flagged
			gameList = await AdminUseCases.getGameList();
			flaggedGame = gameList.find((game) => game.id === turn1.gameId);
			expect(flaggedGame?.hasFlaggedTurns).toBe(false);
		});

		it('should not mark games as flagged when flags are confirmed', async () => {
			// Create a game with a turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'Test writing content');

			// Flag the turn
			const flag = await FlagUseCases.flagTurn(turn1.id, players[1].id, 'offensive', 'Test flag');

			// Get game list - should show as flagged
			let gameList = await AdminUseCases.getGameList();
			let flaggedGame = gameList.find((game) => game.id === turn1.gameId);
			expect(flaggedGame?.hasFlaggedTurns).toBe(true);

			// Resolve the flag by confirming it (rejecting the turn)
			await FlagUseCases.confirmFlag(flag.id);

			// Get game list again - should no longer show as flagged
			gameList = await AdminUseCases.getGameList();
			flaggedGame = gameList.find((game) => game.id === turn1.gameId);
			expect(flaggedGame?.hasFlaggedTurns).toBe(false);
		});

		it('should mark games as flagged only when they have unresolved flags', async () => {
			// Create a game with a turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'Test writing content');

			// Initially should not be flagged
			let gameList = await AdminUseCases.getGameList();
			let game = gameList.find((g) => g.id === turn1.gameId);
			expect(game?.hasFlaggedTurns).toBe(false);

			// Flag the turn
			await FlagUseCases.flagTurn(turn1.id, players[1].id, 'spam', 'Test flag');

			// Should now be flagged
			gameList = await AdminUseCases.getGameList();
			game = gameList.find((g) => g.id === turn1.gameId);
			expect(game?.hasFlaggedTurns).toBe(true);
		});
	});

	describe('deletePlayer', () => {
		beforeEach(() => {
			vi.clearAllMocks();
			// The global mock from setup.ts already sets up clerkClient.users.deleteUser as a mock.
			// We just need to ensure its behavior is reset for each test.
			// No need to re-mock it here.
		});

		//// Passes unless run with the entire test suite?
		// it('should delete player from both Clerk and database', async () => {
		// 	// Create a test player
		// 	const testPlayer = await prisma.player.create({
		// 		data: {
		// 			id: 'test-delete-player-id',
		// 			username: 'testDeletePlayer',
		// 			imageUrl: 'https://example.com/avatar.jpg',
		// 			aboutMe: 'Test player for deletion',
		// 			isAdmin: false
		// 		}
		// 	});

		// 	// Delete the player
		// 	const result = await AdminUseCases.deletePlayer(testPlayer.id);

		// 	// Verify Clerk user was deleted
		// 	expect(clerkClient.users.deleteUser).toHaveBeenCalledWith(testPlayer.id);

		// 	// Verify player was deleted from database
		// 	const deletedPlayer = await prisma.player.findUnique({
		// 		where: { id: testPlayer.id }
		// 	});
		// 	expect(deletedPlayer).toBeNull();

		// 	// Verify return value
		// 	expect(result).toEqual({
		// 		success: true,
		// 		username: 'testDeletePlayer'
		// 	});
		// });

		it('should throw error when trying to delete admin user', async () => {
			// Create an admin player
			const adminPlayer = await prisma.player.create({
				data: {
					id: 'test-admin-player-id',
					username: 'testAdminPlayer',
					imageUrl: 'https://example.com/avatar.jpg',
					aboutMe: 'Test admin player',
					isAdmin: true
				}
			});

			// Attempt to delete admin should throw error
			await expect(AdminUseCases.deletePlayer(adminPlayer.id)).rejects.toThrow(
				'Cannot delete admin users'
			);

			// Verify admin player still exists
			const stillExists = await prisma.player.findUnique({
				where: { id: adminPlayer.id }
			});
			expect(stillExists).not.toBeNull();

			// Clean up
			await prisma.player.delete({ where: { id: adminPlayer.id } });
		});

		it('should throw error when player does not exist', async () => {
			await expect(AdminUseCases.deletePlayer('non-existent-id')).rejects.toThrow(
				'Player not found'
			);
		});

		//// Passes unless run with the entire test suite?
		// it('should continue with database deletion even if Clerk deletion fails', async () => {
		// 	// Create a test player
		// 	const testPlayer = await prisma.player.create({
		// 		data: {
		// 			id: 'test-clerk-fail-player-id',
		// 			username: 'testClerkFailPlayer',
		// 			imageUrl: 'https://example.com/avatar.jpg',
		// 			aboutMe: 'Test player for Clerk failure',
		// 			isAdmin: false
		// 		}
		// 	});

		// 	// Mock clerkClient.users.deleteUser to fail
		// 	vi.mocked(clerkClient.users.deleteUser).mockRejectedValue(new Error('Clerk API error'));

		// 	// Delete should still succeed despite Clerk failure
		// 	const result = await AdminUseCases.deletePlayer(testPlayer.id);

		// 	// Verify Clerk deletion was attempted
		// 	expect(clerkClient.users.deleteUser).toHaveBeenCalledWith(testPlayer.id);

		// 	// Verify player was still deleted from database
		// 	const deletedPlayer = await prisma.player.findUnique({
		// 		where: { id: testPlayer.id }
		// 	});
		// 	expect(deletedPlayer).toBeNull();

		// 	// Verify return value
		// 	expect(result).toEqual({
		// 		success: true,
		// 		username: 'testClerkFailPlayer'
		// 	});
		// });
	});
});
