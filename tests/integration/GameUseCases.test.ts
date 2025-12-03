import { describe, it, expect, beforeEach, vi, afterAll, beforeAll, afterEach } from 'vitest';
import { GameUseCases } from '../../src/lib/server/usecases/GameUseCases';
import { prisma } from '$lib/server/prisma';
import { type Turn, type GameConfig, type Player } from '$lib/types/domain';
import { DAYS, SECONDS, formatDuration } from '$lib/datetime';
import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { fetchDefaultGameConfig } from '$lib/server/services/configService';
import { getPlayers, replaceDefaultConfig } from './helpers';

// Mock PartyUseCases for dynamic import
const mockCheckAndHandlePartyCompletion = vi.fn().mockResolvedValue(true);

// Mock the module before any imports
vi.doMock('$lib/server/usecases/PartyUseCases', () => ({
	PartyUseCases: {
		checkAndHandlePartyCompletion: mockCheckAndHandlePartyCompletion
	}
}));

const minTurns = 2;
const maxTurns = 4;
const writingTimeout = 5 * SECONDS;
const drawingTimeout = 15 * SECONDS;
const gameTimeout = 1 * DAYS;
const testConfig = {
	minTurns,
	maxTurns,
	writingTimeout: formatDuration(writingTimeout),
	drawingTimeout: formatDuration(drawingTimeout),
	gameTimeout: formatDuration(gameTimeout),
	isLewd: false
};

const advanceTime = async (ms: number) => {
	console.log(`🧪 Advancing time by ${ms}ms`);
	vi.advanceTimersByTime(ms);
	await GameUseCases.performExpirations(); // Queue worker will do this in reality
};

// Use describe for tests requiring real database
describe('GameUseCases', () => {
	let players: Player[] = [];
	let defaultConfig: GameConfig;

	beforeAll(async () => {
		vi.resetModules();
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
		defaultConfig = await replaceDefaultConfig(testConfig);
	});

	afterAll(async () => {
		await replaceDefaultConfig(defaultConfig);
		console.log('🧪 Restored default config');
		vi.doUnmock('$lib/server/usecases/PartyUseCases');
	});

	describe('createTurnAndMaybeGame', () => {
		it('should create new game when no available games', async () => {
			let turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			expect(turn.completedAt).toBeFalsy();
			expect(turn.content).toBe('');
			expect(turn.isDrawing).toBeFalsy();
			expect(turn.orderIndex).toBe(0);
			expect(turn.status).toBe('pending');

			expect(await prisma.game.count()).toBe(1);

			let game = await GameUseCases.findGameById(turn.gameId);
			expect(game?.completedAt).toBeFalsy();
			expect(game?.turns).toHaveLength(1);
			expect(game?.turns[0].playerId).toBe(players[0].id);
			expect(game?.turns[0].orderIndex).toBe(0);

			turn = await GameUseCases.completeTurn(turn.id, 'writing', 'Test writing');
			expect(turn.completedAt).toBeTruthy();
			expect(turn.content).toBe('Test writing');
			expect(turn.isDrawing).toBeFalsy();
			expect(turn.orderIndex).toBe(0);
			expect(turn.status).toBe('completed');

			game = await GameUseCases.findGameById(turn.gameId);
			expect(game?.completedAt).toBeFalsy();
			expect(game?.turns).toHaveLength(1);
			expect(game?.turns[0].id).toBe(turn.id);
		});

		it('should throw error when already has pending turn', async () => {
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			expect(turn1.status).toBe('pending');
			await expect(
				async () => await GameUseCases.createTurnAndMaybeGame(players[0].id)
			).rejects.toThrow();
		});

		it('should create new game when first turn expires, allowing different player to claim it', async () => {
			vi.useFakeTimers();
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await advanceTime(writingTimeout + 10);
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			// Since the first turn expired, the game should be deleted and a new game created
			expect(turn1.gameId).not.toBe(turn2.gameId);
			vi.useRealTimers();
		});

		it('should create new game when first turn expires, allowing same player to claim it', async () => {
			vi.useFakeTimers();
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await advanceTime(writingTimeout + 10);
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			// Since the first turn expired, the game should be deleted and a new game created
			expect(turn1.gameId).not.toBe(turn2.gameId);
			vi.useRealTimers();
		});

		it('should add turn to existing incomplete game', async () => {
			// Create initial game and turn
			const firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(firstTurn.id, 'writing', 'Test writing');

			// Create second player's turn
			const secondTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(secondTurn.completedAt).toBeFalsy();
			expect(secondTurn.content).toBe('');
			expect(secondTurn.isDrawing).toBeTruthy();
			expect(secondTurn.orderIndex).toBe(1);
			expect(secondTurn.status).toBe('pending');

			const game = await GameUseCases.findGameById(firstTurn.gameId);
			expect(game?.turns).toHaveLength(2);
			expect(game?.turns[1].id).toBe(secondTurn.id);
		});

		it('should NOT join existing game when incomplete game has pending turn', async () => {
			// This test captures the DESIRED behavior to fix the race condition bug:
			// One player started entering an initial sentence. While that was happening
			// a second player got matched... to the same game!
			//
			// A player should ONLY be matched to a game they haven't played in
			// and ONLY if all its turns are complete (and the game itself is not complete).

			// Create initial game and turn (first player starts writing)
			const firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			expect(firstTurn.completedAt).toBeFalsy(); // Turn is still pending

			// Second player should get a NEW game since first game has incomplete turn
			const secondTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id);

			// DESIRED behavior: Second player should get a different game
			expect(secondTurn.gameId).not.toBe(firstTurn.gameId); // Different games!

			// Verify both games exist and have only one turn each
			const firstGame = await GameUseCases.findGameById(firstTurn.gameId);
			const secondGame = await GameUseCases.findGameById(secondTurn.gameId);

			expect(firstGame?.turns).toHaveLength(1); // First game has only the pending turn
			expect(secondGame?.turns).toHaveLength(1); // Second game has only the new turn
			expect(firstGame?.id).not.toBe(secondGame?.id); // Definitely different games
		});

		it('should only match players to games with all completed turns', async () => {
			// This test shows the CORRECT behavior - players should only be matched
			// to games where ALL existing turns are completed

			// Create initial game and turn, then complete it
			const firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(firstTurn.id, 'writing', 'Completed writing');

			// Now second player should be able to join since all turns are complete
			const secondTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(secondTurn.gameId).toBe(firstTurn.gameId); // Should join same game
			expect(secondTurn.isDrawing).toBe(true); // Next turn should be drawing

			const game = await GameUseCases.findGameById(firstTurn.gameId);
			expect(game?.turns).toHaveLength(2);
			expect(game?.turns[0].completedAt).toBeTruthy(); // First turn completed
			expect(game?.turns[1].completedAt).toBeFalsy(); // Second turn pending
		});

		it('should alternate turn types correctly', async () => {
			let turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'Writing 1');

			turn = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn.isDrawing).toBe(true);
			await GameUseCases.completeTurn(turn.id, 'drawing', 'drawing.png');

			turn = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			expect(turn.isDrawing).toBe(false);
		});

		it('should not match a player to a game that has a flagged turn', async () => {
			// This test proposes how the behavior should work
			// It requires modifying the createTurnAndMaybeGame method to filter out games with flagged turns

			// Create a game and complete a turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'first turn content');

			// Create a second turn and complete it
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toBe(turn1.gameId); // Verify it's the same game
			await GameUseCases.completeTurn(turn2.id, 'drawing', '2ndturn.png');

			// Flag the first turn
			await FlagUseCases.flagTurn(turn1.id, players[2].id, 'offensive');

			// PROPOSED IMPLEMENTATION:
			// The createTurnAndMaybeGame method should be modified to include this condition in the query:
			// turns: { none: { flags: { some: { resolvedAt: null } } } }

			// For this test to pass, the implementation needs to be updated
			// Try to match a new player to a game
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[3].id);

			// The player should be matched to a new game, not the flagged one
			expect(turn3.gameId).not.toBe(turn1.gameId);

			// Verify that a new game was created
			const game = await GameUseCases.findGameById(turn3.gameId);
			expect(game).not.toBeNull();
			expect(game?.turns.length).toBe(1);
		});
	});

	describe('completeTurn', () => {
		it('should mark turn as completed', async () => {
			let turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			turn = await GameUseCases.completeTurn(turn.id, 'writing', 'Test writing');
			expect(turn.completedAt).toBeTruthy();
			expect(turn.content).toBe('Test writing');
			expect(turn.isDrawing).toBeFalsy();
			expect(turn.orderIndex).toBe(0);
			expect(turn.status).toBe('completed');

			const game = await GameUseCases.findGameById(turn.gameId);
			expect(game?.completedAt).toBeFalsy();
			expect(game?.turns).toHaveLength(1);
			expect(game?.turns[0].id).toBe(turn.id);
		});

		it('should complete game when reaching max turns', async () => {
			let turn: Turn;
			for (let i = 0; i < 4; i++) {
				turn = await GameUseCases.createTurnAndMaybeGame(players[i].id);
				turn = await GameUseCases.completeTurn(
					turn.id,
					i % 2 === 0 ? 'writing' : 'drawing',
					i % 2 === 0 ? 'Test writing' : 'test_drawing.png'
				);
			}
			const completedGame = await GameUseCases.findGameById(turn!.gameId);
			expect(completedGame?.completedAt).toBeTruthy();
			expect(completedGame?.turns).toHaveLength(4);
		});

		it('should throw error when completing non-existent turn', async () => {
			await expect(
				async () => await GameUseCases.completeTurn('invalid-turn-id', 'writing', 'Test writing')
			).rejects.toThrow('Game not found');
		});

		it('should throw error when attempting to complete already completed turn', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'First completion');
			await expect(
				async () => await GameUseCases.completeTurn(turn.id, 'writing', 'Second attempt')
			).rejects.toThrow(`No turns to complete`);
		});

		it('should complete a turn', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'test content');
			const game = await GameUseCases.findGameById(turn.gameId);
			expect(game?.turns[0].content).toBe('test content');
			expect(game?.turns[0].completedAt).toBeTruthy();
		});

		it('should not complete a turn twice', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'test content');
			await expect(GameUseCases.completeTurn(turn.id, 'writing', 'test content')).rejects.toThrow();
			const game = await GameUseCases.findGameById(turn.gameId);
			expect(game?.turns[0].content).toBe('test content');
		});

		it('should complete a game when max turns is reached', async () => {
			// Complete all turns up to maxTurns
			let lastTurn;
			for (let i = 0; i < maxTurns; i++) {
				lastTurn = await GameUseCases.createTurnAndMaybeGame(players[i % players.length].id);
				await GameUseCases.completeTurn(
					lastTurn.id,
					i % 2 === 0 ? 'writing' : 'drawing',
					i % 2 === 0 ? `writing ${i}` : `drawing${i}.png`
				);
			}
			const completedGame = await GameUseCases.findGameById(lastTurn!.gameId);
			expect(completedGame?.completedAt).toBeTruthy();
		});

		it('should not complete a game when max turns is not reached', async () => {
			const firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(firstTurn.id, 'writing', 'test content');

			const firstGame = await GameUseCases.findGameById(firstTurn.gameId);

			const secondTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(secondTurn.gameId).toBe(firstGame?.id);
			await GameUseCases.completeTurn(secondTurn.id, 'drawing', '2ndturn.png');

			const secondGame = await GameUseCases.findGameById(secondTurn.gameId);
			expect(secondGame?.completedAt).toBeFalsy();
		});

		it('should not complete a game when max turns is 0', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'test content');
			const game = await GameUseCases.findGameById(turn.gameId);
			expect(game?.completedAt).toBeFalsy();
		});

		it('should hide flagged games from non-admin users', async () => {
			// Create a game and complete a turn
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'test content');

			// Create a flag using an existing test player
			await FlagUseCases.flagTurn(turn.id, players[1].id, 'spam');

			// Non-admin user should not see the game
			const gameForUser = await GameUseCases.findGameById(turn.gameId);
			expect(gameForUser).toBeNull();

			// Admin user should see the game
			const gameForAdminDirect = await GameUseCases.findGameByIdAdmin(turn.gameId);
			expect(gameForAdminDirect).not.toBeNull();
		});

		it.skip('should include correct actionUrl for game_completion notifications', async () => {
			// Clean up any existing notifications
			await prisma.notification.deleteMany();

			// Create a game with min and max turns set to 1 so it completes immediately
			const config = await fetchDefaultGameConfig();
			await replaceDefaultConfig({ ...config, minTurns: 1, maxTurns: 1 });

			try {
				// Create and complete a turn (this should complete the game)
				const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
				await GameUseCases.completeTurn(turn.id, 'writing', 'test content');

				// Check that game completion notifications were created with correct actionUrl
				const completionNotifications = await prisma.notification.findMany({
					where: {
						type: 'game_completion',
						userId: players[0].id,
						data: {
							path: ['gameId'],
							equals: turn.gameId
						}
					}
				});

				expect(completionNotifications).toHaveLength(1);
				expect(completionNotifications[0].actionUrl).toBe(`/g/${turn.gameId}`);
			} finally {
				// Restore original test config
				await replaceDefaultConfig(testConfig);
			}
		});
	});

	describe('performExpirations', () => {
		beforeEach(async () => {
			vi.useFakeTimers();
		});

		it('should delete expired pending initial turns', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await advanceTime(writingTimeout + 10);
			// Turn should not be accessible since the game is marked as deleted
			expect(await GameUseCases.findTurnById(turn.id)).toBeNull();
		});

		it('should not delete non-expired turns', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await advanceTime(writingTimeout - 10);
			expect(await GameUseCases.findTurnById(turn.id)).not.toBeNull();
		});

		it('should mark game as deleted when first turn expires', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			expect(turn.orderIndex).toBe(0); // Verify this is the first turn

			// Verify game exists before expiration
			const gameBeforeExpiration = await GameUseCases.findGameById(turn.gameId);
			expect(gameBeforeExpiration).not.toBeNull();

			// Advance time to expire the first turn
			await advanceTime(writingTimeout + 10);

			// The turn should be gone (deleted as part of game deletion)
			expect(await GameUseCases.findTurnById(turn.id)).toBeNull();

			// The game should be marked as deleted (not visible via findGameById)
			const gameAfterExpiration = await GameUseCases.findGameById(turn.gameId);
			expect(gameAfterExpiration).toBeNull();

			// Admin should still be able to see the deleted game
			const gameForAdmin = await GameUseCases.findGameByIdAdmin(turn.gameId);
			expect(gameForAdmin).not.toBeNull();
			expect(gameForAdmin?.deletedAt).not.toBeNull();
		});

		it('should only delete the turn when non-first turn expires', async () => {
			// Create and complete first turn
			const firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(firstTurn.id, 'writing', 'First turn content');

			// Create second turn
			const secondTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(secondTurn.orderIndex).toBe(1); // Verify this is the second turn
			expect(secondTurn.gameId).toBe(firstTurn.gameId); // Same game

			// Advance time to expire the second turn
			await advanceTime(drawingTimeout + 10);

			// The second turn should be deleted
			expect(await GameUseCases.findTurnById(secondTurn.id)).toBeNull();

			// The game should still exist (not deleted)
			const gameAfterExpiration = await GameUseCases.findGameById(firstTurn.gameId);
			expect(gameAfterExpiration).not.toBeNull();
			expect(gameAfterExpiration?.deletedAt).toBeNull();

			// The first turn should still exist
			expect(await GameUseCases.findTurnById(firstTurn.id)).not.toBeNull();
		});
	});

	describe('game expiration fallback', () => {
		beforeEach(async () => {
			vi.useFakeTimers();
		});

		it('should expire games via performExpirations when queue scheduling fails', async () => {
			// Create a game that should expire quickly
			const config = await fetchDefaultGameConfig();
			const shortTimeoutConfig = {
				...config,
				minTurns: 1, // Set minimum turns to 1
				gameTimeout: '1s' // 1 second timeout
			};

			const game = await GameUseCases.createGame(shortTimeoutConfig);

			// Verify game exists and is not completed
			const gameBeforeExpiration = await GameUseCases.findGameById(game.id);
			expect(gameBeforeExpiration).not.toBeNull();
			expect(gameBeforeExpiration?.completedAt).toBeNull();

			// Create and complete one turn to meet minimum turn requirement
			const turn = await GameUseCases.createTurn(players[0].id, game);
			await GameUseCases.completeTurn(turn.id, 'writing', 'Test content');

			// Now advance time past the NEW expiration time (after turn completion)
			// When a turn is completed, the game expiration is extended by gameTimeout
			vi.advanceTimersByTime(2000); // 2 seconds to be safe

			// Run the fallback expiration check (simulates what the interval would do)
			await GameUseCases.performExpirations();

			// Game should now be completed due to expiration
			const gameAfterExpiration = await GameUseCases.findGameById(game.id);
			expect(gameAfterExpiration?.completedAt).not.toBeNull();
		});

		it('should not expire games that have insufficient completed turns', async () => {
			// Create a game with higher minimum turn requirement
			const config = await fetchDefaultGameConfig();
			const highMinTurnsConfig = {
				...config,
				minTurns: 3,
				gameTimeout: '1s' // 1 second timeout
			};

			const game = await GameUseCases.createGame(highMinTurnsConfig);

			// Create and complete only one turn (less than minTurns)
			const turn = await GameUseCases.createTurn(players[0].id, game);
			await GameUseCases.completeTurn(turn.id, 'writing', 'Test content');

			// Advance time past the NEW expiration time (after turn completion)
			vi.advanceTimersByTime(2000); // 2 seconds

			// Run the fallback expiration check
			await GameUseCases.performExpirations();

			// Game should still not be completed (insufficient turns)
			const gameAfterExpiration = await GameUseCases.findGameById(game.id);
			expect(gameAfterExpiration?.completedAt).toBeNull();
		});
	});

	describe('lewd game functionality', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		it('should create lewd game when isLewd option is true', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: true });
			const game = await GameUseCases.findGameById(turn.gameId);

			expect(game?.isLewd).toBe(true);
		});

		it('should create non-lewd game when isLewd option is false', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: false });
			const game = await GameUseCases.findGameById(turn.gameId);

			expect(game?.isLewd).toBe(false);
		});

		it('should create non-lewd game when isLewd option is not specified', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			const game = await GameUseCases.findGameById(turn.gameId);

			expect(game?.isLewd).toBe(false);
		});

		it('should not match player to lewd game when looking for non-lewd game', async () => {
			// Create a lewd game
			await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: true });

			// Player 1 should get a new non-lewd game, not join the existing lewd game
			const turn = await GameUseCases.createTurnAndMaybeGame(players[1].id, { isLewd: false });
			const game = await GameUseCases.findGameById(turn.gameId);

			expect(game?.isLewd).toBe(false);
		});

		it('should not match player to non-lewd game when looking for lewd game', async () => {
			// Create a non-lewd game
			await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: false });

			// Player 1 should get a new lewd game, not join the existing non-lewd game
			const turn = await GameUseCases.createTurnAndMaybeGame(players[1].id, { isLewd: true });
			const game = await GameUseCases.findGameById(turn.gameId);

			expect(game?.isLewd).toBe(true);
		});

		it('should match player to existing lewd game when looking for lewd game', async () => {
			// Create a lewd game
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: true });
			await GameUseCases.completeTurn(turn1.id, 'writing', 'Test content');

			// Player 1 should join the existing lewd game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id, { isLewd: true });

			expect(turn2.gameId).toBe(turn1.gameId);
		});

		it('should match player to existing non-lewd game when looking for non-lewd game', async () => {
			// Create a non-lewd game
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: false });
			await GameUseCases.completeTurn(turn1.id, 'writing', 'Test content');

			// Player 1 should join the existing non-lewd game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id, { isLewd: false });

			expect(turn2.gameId).toBe(turn1.gameId);
		});

		it('should filter lewd games in getGamesForGallery when showLewd is false', async () => {
			await replaceDefaultConfig({ ...testConfig, minTurns: 1, maxTurns: 1 });
			// Create both lewd and non-lewd games
			const lewdTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: true });
			const nonLewdTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id, {
				isLewd: false
			});

			// Complete both games
			await GameUseCases.completeTurn(lewdTurn.id, 'writing', 'Lewd content');
			await GameUseCases.completeTurn(nonLewdTurn.id, 'writing', 'Clean content');

			// Query with showLewd: false
			const result = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 1,
				limit: 10,
				showLewd: false
			});

			const foundLewdGame = result.games.find((g) => g.isLewd);
			const foundNonLewdGame = result.games.find((g) => !g.isLewd);

			expect(foundLewdGame).toBeUndefined();
			expect(foundNonLewdGame).toBeDefined();
			await replaceDefaultConfig(testConfig);
		});

		it('should show both lewd and non-lewd games in getGamesForGallery when showLewd is true', async () => {
			await replaceDefaultConfig({ ...testConfig, minTurns: 1, maxTurns: 1 });
			// Create both lewd and non-lewd games
			const lewdTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id, { isLewd: true });
			const nonLewdTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id, {
				isLewd: false
			});

			// Complete both games
			await GameUseCases.completeTurn(lewdTurn.id, 'writing', 'Lewd content');
			await GameUseCases.completeTurn(nonLewdTurn.id, 'writing', 'Clean content');

			// Query without showLewd parameter
			const result = await GameUseCases.getGamesForGallery({
				filter: 'latest',
				page: 1,
				limit: 10,
				showLewd: true
			});

			const foundLewdGame = result.games.find((g) => g.isLewd);
			const foundNonLewdGame = result.games.find((g) => !g.isLewd);

			expect(foundLewdGame).toBeDefined();
			expect(foundNonLewdGame).toBeDefined();
			await replaceDefaultConfig(testConfig);
		});
	});

	describe('completeGame - Party Completion Integration', () => {
		beforeEach(async () => {
			// Clear previous calls to the mock
			mockCheckAndHandlePartyCompletion.mockClear();
		});

		it('should check party completion when completing a game with seasonId', async () => {
			// Create a test season first
			const season = await prisma.season.create({
				data: {
					title: 'Test Season',
					status: 'active',
					minPlayers: 2,
					maxPlayers: 10,
					creator: {
						connect: { id: players[0].id }
					},
					gameConfig: {
						create: {
							...testConfig,
							id: 'test-config-1'
						}
					}
				}
			});

			// Create a game and associate it with the season
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await prisma.game.update({
				where: { id: turn.gameId },
				data: { seasonId: season.id }
			});

			// Complete the game
			await GameUseCases.completeGame(turn.gameId);

			// Verify party completion was checked
			expect(mockCheckAndHandlePartyCompletion).toHaveBeenCalledWith(season.id);
		});

		it('should not check party completion when completing a game without seasonId', async () => {
			// Create a regular game (no seasonId)
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);

			// Complete the game
			await GameUseCases.completeGame(turn.gameId);

			// Verify party completion was not checked
			expect(mockCheckAndHandlePartyCompletion).not.toHaveBeenCalled();
		});

		it('should handle party completion check failure gracefully', async () => {
			// Create a test season first
			const season = await prisma.season.create({
				data: {
					title: 'Test Season 2',
					status: 'active',
					minPlayers: 2,
					maxPlayers: 10,
					creator: {
						connect: { id: players[0].id }
					},
					gameConfig: {
						create: {
							...testConfig,
							id: 'test-config-2'
						}
					}
				}
			});

			// Create a game with seasonId
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await prisma.game.update({
				where: { id: turn.gameId },
				data: { seasonId: season.id }
			});

			// Mock PartyUseCases to throw an error
			mockCheckAndHandlePartyCompletion.mockRejectedValue(new Error('Party completion failed'));

			// Complete the game - should not throw despite party check failure
			await expect(GameUseCases.completeGame(turn.gameId)).resolves.toBeUndefined();

			// Verify the game was still completed (check via admin method to bypass filtering)
			const completedGame = await GameUseCases.findGameByIdAdmin(turn.gameId);
			expect(completedGame?.completedAt).toBeTruthy();
		});

		it('should not trigger party completion check for already completed games', async () => {
			// Create a test season first
			const season = await prisma.season.create({
				data: {
					title: 'Test Season 3',
					status: 'active',
					minPlayers: 2,
					maxPlayers: 10,
					creator: {
						connect: { id: players[0].id }
					},
					gameConfig: {
						create: {
							...testConfig,
							id: 'test-config-3'
						}
					}
				}
			});

			// Create and complete a game
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await prisma.game.update({
				where: { id: turn.gameId },
				data: {
					seasonId: season.id,
					completedAt: new Date()
				}
			});

			// Try to complete the already completed game
			await GameUseCases.completeGame(turn.gameId);

			// Verify party completion was not checked since game was already completed
			expect(mockCheckAndHandlePartyCompletion).not.toHaveBeenCalled();
		});
	});
});
