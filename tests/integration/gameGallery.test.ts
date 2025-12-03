import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { GameUseCases } from '../../src/lib/server/usecases/GameUseCases';
import { FlagUseCases } from '../../src/lib/server/usecases/FlagUseCases';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { prisma } from '$lib/server/prisma';
import type { Player, GameConfig } from '$lib/types/domain';
import { DAYS, SECONDS, formatDuration } from '$lib/datetime';
import { getPlayers, replaceDefaultConfig } from './helpers';

const writingTimeout = 5 * SECONDS;
const drawingTimeout = 15 * SECONDS;
const gameTimeout = 1 * DAYS;
const testConfig = {
	minTurns: 2,
	maxTurns: 4,
	writingTimeout: formatDuration(writingTimeout),
	drawingTimeout: formatDuration(drawingTimeout),
	gameTimeout: formatDuration(gameTimeout),
	isLewd: false
};

describe('Game Gallery', () => {
	let players: Player[] = [];
	let defaultConfig: GameConfig;

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
		defaultConfig = await replaceDefaultConfig(testConfig);
	});

	afterAll(async () => {
		await replaceDefaultConfig(defaultConfig);
		console.log('🧪 Restored default config');
	});

	beforeEach(async () => {
		// Clean up any existing games before each test
		await prisma.game.deleteMany({});
	});

	describe('getGamesForGallery', () => {
		it('should return empty array when no completed games exist', async () => {
			const result = await GameUseCases.getGamesForGallery({
				filter: 'best-30',
				page: 1,
				limit: 20
			});

			expect(result.games).toEqual([]);
			expect(result.hasMore).toBe(false);
			expect(result.total).toBe(0);
		});

		it('should only return completed games', async () => {
			// Create an incomplete game
			const incompleteTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(incompleteTurn.id, 'writing', 'Test writing');

			// Create a completed game
			const completedGame = await createCompletedGame();

			const result = await GameUseCases.getGamesForGallery({
				filter: 'best-30',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(1);
			expect(result.games[0].id).toBe(completedGame.id);
			expect(result.games[0].completedAt).toBeTruthy();
		});

		it('should not return games with unresolved flags', async () => {
			// Create a completed game
			const completedGame = await createCompletedGame();

			// Flag one of the turns (use a different player than the one who created the turn)
			const firstTurn = completedGame.turns[0];
			const flaggerId = players.find((p) => p.id !== firstTurn.playerId)?.id || players[1].id;
			await FlagUseCases.flagTurn(firstTurn.id, flaggerId, 'offensive');

			const result = await GameUseCases.getGamesForGallery({
				filter: 'best-30',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(0);
		});

		it('should return games with resolved flags', async () => {
			// Create a completed game
			const completedGame = await createCompletedGame();

			// Flag and then resolve the flag
			const firstTurn = completedGame.turns[0];
			const flaggerId = players.find((p) => p.id !== firstTurn.playerId)?.id || players[1].id;
			const flag = await FlagUseCases.flagTurn(firstTurn.id, flaggerId, 'offensive');
			await FlagUseCases.rejectFlag(flag.id);

			const result = await GameUseCases.getGamesForGallery({
				filter: 'best-30',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(1);
			expect(result.games[0].id).toBe(completedGame.id);
		});

		it('should filter by date for best-7 filter', async () => {
			// Create a game completed 10 days ago
			const oldGame = await createCompletedGame();
			const tenDaysAgo = new Date();
			tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
			await prisma.game.update({
				where: { id: oldGame.id },
				data: { completedAt: tenDaysAgo }
			});

			// Create a game completed 3 days ago
			const recentGame = await createCompletedGame();
			const threeDaysAgo = new Date();
			threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
			await prisma.game.update({
				where: { id: recentGame.id },
				data: { completedAt: threeDaysAgo }
			});

			const result = await GameUseCases.getGamesForGallery({
				filter: 'best-7',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(1);
			expect(result.games[0].id).toBe(recentGame.id);
		});

		it('should filter by date for best-30 filter', async () => {
			// Create a game completed 40 days ago
			const oldGame = await createCompletedGame();
			const fortyDaysAgo = new Date();
			fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
			await prisma.game.update({
				where: { id: oldGame.id },
				data: { completedAt: fortyDaysAgo }
			});

			// Create a game completed 20 days ago
			const recentGame = await createCompletedGame();
			const twentyDaysAgo = new Date();
			twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
			await prisma.game.update({
				where: { id: recentGame.id },
				data: { completedAt: twentyDaysAgo }
			});

			const result = await GameUseCases.getGamesForGallery({
				filter: 'best-30',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(1);
			expect(result.games[0].id).toBe(recentGame.id);
		});

		it('should return all completed games for best-all filter', async () => {
			// Create games with different completion dates
			const oldGame = await createCompletedGame();
			const fortyDaysAgo = new Date();
			fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
			await prisma.game.update({
				where: { id: oldGame.id },
				data: { completedAt: fortyDaysAgo }
			});

			const recentGame = await createCompletedGame();

			const result = await GameUseCases.getGamesForGallery({
				filter: 'best-all',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(2);
			expect(result.games.map((g) => g.id)).toContain(oldGame.id);
			expect(result.games.map((g) => g.id)).toContain(recentGame.id);
		});

		it('should order by completion date for latest filter', async () => {
			// Create multiple games with different completion dates
			const game1 = await createCompletedGame();
			const game2 = await createCompletedGame();
			const game3 = await createCompletedGame();

			// Update completion dates to ensure specific order
			const now = new Date();
			await prisma.game.update({
				where: { id: game1.id },
				data: { completedAt: new Date(now.getTime() - 3000) } // 3 seconds ago
			});
			await prisma.game.update({
				where: { id: game2.id },
				data: { completedAt: new Date(now.getTime() - 1000) } // 1 second ago
			});
			await prisma.game.update({
				where: { id: game3.id },
				data: { completedAt: now } // now
			});

			const result = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(3);
			expect(result.games[0].id).toBe(game3.id); // Most recent first
			expect(result.games[1].id).toBe(game2.id);
			expect(result.games[2].id).toBe(game1.id);
		});

		it('should handle pagination correctly', async () => {
			// Create 5 games
			const games = [];
			for (let i = 0; i < 5; i++) {
				games.push(await createCompletedGame());
			}

			// Test first page with limit 2
			const page1 = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 1,
				limit: 2
			});

			expect(page1.games).toHaveLength(2);
			expect(page1.hasMore).toBe(true);
			expect(page1.total).toBe(5);

			// Test second page
			const page2 = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 2,
				limit: 2
			});

			expect(page2.games).toHaveLength(2);
			expect(page2.hasMore).toBe(true);
			expect(page2.total).toBe(5);

			// Test third page (last page)
			const page3 = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 3,
				limit: 2
			});

			expect(page3.games).toHaveLength(1);
			expect(page3.hasMore).toBe(false);
			expect(page3.total).toBe(5);

			// Ensure no duplicate games across pages
			const allGameIds = [
				...page1.games.map((g) => g.id),
				...page2.games.map((g) => g.id),
				...page3.games.map((g) => g.id)
			];
			const uniqueGameIds = new Set(allGameIds);
			expect(uniqueGameIds.size).toBe(5);
		});

		it('should include game metadata and turns', async () => {
			const game = await createCompletedGame();

			const result = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(1);
			const returnedGame = result.games[0];

			expect(returnedGame.id).toBe(game.id);
			expect(returnedGame.completedAt).toBeTruthy();
			expect(returnedGame.turns).toHaveLength(4); // 4 turns in completed game
			expect(returnedGame.completedCount).toBe(4);

			// Check that turns include player information
			returnedGame.turns.forEach((turn) => {
				expect(turn.player).toBeDefined();
				expect(turn.player?.id).toBeDefined();
				expect(turn.player?.username).toBeDefined();
			});
		});

		it('should not include rejected turns', async () => {
			const game = await createCompletedGame();

			// Reject one of the turns
			const firstTurn = game.turns[0];
			await prisma.turn.update({
				where: { id: firstTurn.id },
				data: { rejectedAt: new Date() }
			});

			const result = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 1,
				limit: 20
			});

			expect(result.games).toHaveLength(1);
			const returnedGame = result.games[0];

			// Should only have 3 turns now (excluding the rejected one)
			expect(returnedGame.turns).toHaveLength(3);
			expect(returnedGame.turns.find((t) => t.id === firstTurn.id)).toBeUndefined();
		});
	});

	// Helper function to create a completed game with 4 turns
	async function createCompletedGame() {
		// Create a game manually and add turns to it
		const config = await prisma.gameConfig.findUnique({ where: { id: 'default' } });
		if (!config) throw new Error('Default config not found');

		let game = await GameUseCases.createGame(config);

		// Create and complete 4 turns manually, refreshing game state each time
		const turn1 = await GameUseCases.createTurn(players[0].id, game);
		await GameUseCases.completeTurn(turn1.id, 'writing', 'First writing');

		const updatedGame1 = await GameUseCases.findGameByIdAdmin(game.id);
		if (!updatedGame1) throw new Error('Game not found after turn 1');
		game = updatedGame1;
		const turn2 = await GameUseCases.createTurn(players[1].id, game);
		await GameUseCases.completeTurn(turn2.id, 'drawing', 'drawing1.png');

		const updatedGame2 = await GameUseCases.findGameByIdAdmin(game.id);
		if (!updatedGame2) throw new Error('Game not found after turn 2');
		game = updatedGame2;
		const turn3 = await GameUseCases.createTurn(players[2].id, game);
		await GameUseCases.completeTurn(turn3.id, 'writing', 'Second writing');

		const updatedGame3 = await GameUseCases.findGameByIdAdmin(game.id);
		if (!updatedGame3) throw new Error('Game not found after turn 3');
		game = updatedGame3;
		const turn4 = await GameUseCases.createTurn(players[3].id, game);
		await GameUseCases.completeTurn(turn4.id, 'drawing', 'drawing2.png');

		// Fetch the completed game
		const completedGame = await GameUseCases.findGameByIdAdmin(game.id);
		expect(completedGame?.completedAt).toBeTruthy();
		return completedGame!;
	}
});
