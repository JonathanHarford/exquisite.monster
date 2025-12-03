import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { prisma } from '$lib/server/prisma';
import type { Player, Turn } from '@prisma/client';
import type { GameConfig } from '$lib/types/domain';
import { getPlayers, getAdmin, replaceDefaultConfig } from './helpers';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { SECONDS, DAYS, formatDuration } from '$lib/datetime';

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

describe('Flag Logic', () => {
	let players: Player[] = [];
	let adminPlayer: Player;
	let defaultConfig: GameConfig;
	let firstTurn: Turn;

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
		adminPlayer = await getAdmin(allUsers);
		defaultConfig = await replaceDefaultConfig(testConfig);
	});

	afterAll(async () => {
		await replaceDefaultConfig(defaultConfig);
		console.log('🧪 Restored default config');
	});

	beforeEach(async () => {
		// Clean up any existing data
		await prisma.$transaction([
			prisma.notification.deleteMany(),
			prisma.turnFlag.deleteMany(),
			prisma.turn.deleteMany(),
			prisma.game.deleteMany()
		]);

		// Create a basic game setup for each test
		firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
		await GameUseCases.completeTurn(firstTurn.id, 'writing', 'offensive sentence');
	});

	describe('Turn flagging behavior', () => {
		it('should hide flagged games from all players', async () => {
			// Player 2 joins the game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toBe(firstTurn.gameId);

			// Player 2 flags the first turn
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag');

			// Game should be hidden from all non-admin players
			const gameForPlayer1 = await GameUseCases.findGameById(firstTurn.gameId);
			const gameForPlayer2 = await GameUseCases.findGameById(firstTurn.gameId);
			const gameForPlayer3 = await GameUseCases.findGameById(firstTurn.gameId);

			expect(gameForPlayer1).toBeNull();
			expect(gameForPlayer2).toBeNull();
			expect(gameForPlayer3).toBeNull();
		});

		it('should delete pending turns when a turn is flagged', async () => {
			// Player 2 joins the game and gets a pending turn
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toBe(firstTurn.gameId);
			expect(turn2.status).toBe('pending');

			// Player 2 flags the first turn (should delete their own pending turn)
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag');

			// The pending turn should be deleted
			const deletedTurn = await prisma.turn.findUnique({
				where: { id: turn2.id }
			});
			expect(deletedTurn).toBeNull();
		});

		it('should prevent players from creating multiple flags', async () => {
			// Player 2 joins and flags first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag');

			// Player 2 starts a new game
			const newTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await GameUseCases.completeTurn(newTurn.id, 'writing', 'another sentence');

			// Player 2 should not be able to flag another turn while having a pending flag
			await expect(
				FlagUseCases.flagTurn(newTurn.id, players[1].id, 'offensive', 'Another flag')
			).rejects.toThrow('Player already has a pending flag');
		});

		it('should exclude flagged games from createTurnAndMaybeGame matching', async () => {
			// Complete the first turn and add a second turn
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'test.png');

			// Player 3 flags the first turn
			await FlagUseCases.flagTurn(firstTurn.id, players[2].id, 'offensive');

			// Player 4 should not be matched to the flagged game
			const turn4 = await GameUseCases.createTurnAndMaybeGame(players[3].id);
			expect(turn4.gameId).not.toBe(firstTurn.gameId);
		});

		it('should exclude games where player previously flagged from matching', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Admin resolves the flag by rejecting it (allowing the turn)
			const flags = await prisma.turnFlag.findMany({
				where: { turnId: firstTurn.id, resolvedAt: null }
			});
			await FlagUseCases.rejectFlag(flags[0].id);

			// Player 2 should not be matched to this game again, even though flag is resolved
			const newTurn = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(newTurn.gameId).not.toBe(firstTurn.gameId);
		});
	});

	describe('Flag resolution behavior', () => {
		it('should make game visible again after flag is resolved', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Game should be hidden
			const hiddenGame = await GameUseCases.findGameById(firstTurn.gameId);
			expect(hiddenGame).toBeNull();

			// Admin resolves the flag by rejecting it
			const flags = await prisma.turnFlag.findMany({
				where: { turnId: firstTurn.id, resolvedAt: null }
			});
			await FlagUseCases.rejectFlag(flags[0].id);

			// Game should be visible again
			const visibleGame = await GameUseCases.findGameById(firstTurn.gameId);
			expect(visibleGame).not.toBeNull();
			expect(visibleGame?.turns).toHaveLength(1); // Original turn should be visible
		});

		it('should filter out rejected turns from game view', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Admin confirms the flag (rejecting the turn)
			const flags = await prisma.turnFlag.findMany({
				where: { turnId: firstTurn.id, resolvedAt: null }
			});
			await FlagUseCases.confirmFlag(flags[0].id);

			// Game should be visible but rejected turn should be filtered out
			const gameWithRejectedTurn = await GameUseCases.findGameById(firstTurn.gameId);
			expect(gameWithRejectedTurn).not.toBeNull();
			expect(gameWithRejectedTurn?.turns).toHaveLength(0); // Rejected turn should be filtered out
		});

		it('should allow new players to join game after flag resolution', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Admin rejects the flag (allowing the turn)
			const flags = await prisma.turnFlag.findMany({
				where: { turnId: firstTurn.id, resolvedAt: null }
			});
			await FlagUseCases.rejectFlag(flags[0].id);

			// Player 3 should be able to join the game
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			expect(turn3.gameId).toBe(firstTurn.gameId);
			expect(turn3.isDrawing).toBe(true); // Should be drawing after the writing turn
		});

		it('should handle rejected turn scenario correctly', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Admin confirms the flag (rejecting the turn)
			const flags = await prisma.turnFlag.findMany({
				where: { turnId: firstTurn.id, resolvedAt: null }
			});
			await FlagUseCases.confirmFlag(flags[0].id);

			// Player 3 should be able to join the game but start fresh since rejected turn is filtered
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			expect(turn3.gameId).toBe(firstTurn.gameId);
			expect(turn3.isDrawing).toBe(false); // Should be writing since no valid previous turns
			expect(turn3.orderIndex).toBe(1); // Order index continues from rejected turn
		});
	});

	describe('Admin flag management', () => {
		it('should properly mark turn as rejected when flag is confirmed', async () => {
			// Player 2 flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			const flag = await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Admin confirms the flag
			await FlagUseCases.confirmFlag(flag.id);

			// Turn should be marked as rejected
			const rejectedTurn = await prisma.turn.findUnique({
				where: { id: firstTurn.id }
			});
			expect(rejectedTurn?.rejectedAt).not.toBeNull();

			// Flag should be resolved
			const resolvedFlag = await prisma.turnFlag.findUnique({
				where: { id: flag.id }
			});
			expect(resolvedFlag?.resolvedAt).not.toBeNull();
		});

		it('should not mark turn as rejected when flag is rejected', async () => {
			// Player 2 flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			const flag = await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Admin rejects the flag
			await FlagUseCases.rejectFlag(flag.id);

			// Turn should NOT be marked as rejected
			const notRejectedTurn = await prisma.turn.findUnique({
				where: { id: firstTurn.id }
			});
			expect(notRejectedTurn?.rejectedAt).toBeNull();

			// Flag should be resolved
			const resolvedFlag = await prisma.turnFlag.findUnique({
				where: { id: flag.id }
			});
			expect(resolvedFlag?.resolvedAt).not.toBeNull();
		});
	});

	describe('Game visibility behavior', () => {
		it('should return null from findGameById when game has unresolved flags', async () => {
			// Player 2 joins the game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toBe(firstTurn.gameId);

			// Player 2 flags the first turn
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag');

			// findGameById should return null for any player (including the original player)
			const gameForOriginalPlayer = await GameUseCases.findGameById(firstTurn.gameId);
			const gameForFlagger = await GameUseCases.findGameById(firstTurn.gameId);
			const gameForOtherPlayer = await GameUseCases.findGameById(firstTurn.gameId);

			expect(gameForOriginalPlayer).toBeNull();
			expect(gameForFlagger).toBeNull();
			expect(gameForOtherPlayer).toBeNull();
		});

		it('should return game from findGameByIdAdmin even when flagged', async () => {
			// Player 2 joins the game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toBe(firstTurn.gameId);

			// Player 2 flags the first turn (this will delete the pending turn2)
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag');

			// Admin should still be able to see the game
			const gameForAdmin = await GameUseCases.findGameByIdAdmin(firstTurn.gameId);
			expect(gameForAdmin).not.toBeNull();
			expect(gameForAdmin?.turns).toHaveLength(1); // Only the flagged turn should be visible (pending turn was deleted)
		});
	});

	it('should allow player to complete turn after previous turn was rejected', async () => {
		// Player 2 joins and submits a drawing turn
		const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
		await GameUseCases.completeTurn(turn2.id, 'drawing', 'test-drawing.jpg');

		// Player 3 flags Player 2's turn
		const flag = await FlagUseCases.flagTurn(turn2.id, players[2].id, 'offensive');

		// Admin confirms the flag (rejects the turn)
		await FlagUseCases.confirmFlag(flag.id);

		// Player 4 should be able to join the game and complete their turn
		// This should NOT throw a 500 error due to the indexing bug
		const turn4 = await GameUseCases.createTurnAndMaybeGame(players[3].id);

		// This should work without throwing an error
		await expect(
			GameUseCases.completeTurn(turn4.id, 'drawing', 'test-drawing-4.jpg')
		).resolves.not.toThrow();
	});

	describe('Notification actionUrl verification', () => {
		it('should include correct actionUrl for admin_flag notifications', async () => {
			// Create a game and complete a turn
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'test content');

			// Flag the turn
			await FlagUseCases.flagTurn(turn.id, players[1].id, 'spam', 'Test flag');

			// Check that admin notifications were created with correct actionUrl
			const adminNotifications = await prisma.notification.findMany({
				where: {
					type: 'admin_flag',
					userId: adminPlayer.id,
					data: {
						path: ['gameId'],
						equals: turn.gameId
					}
				}
			});

			expect(adminNotifications).toHaveLength(1);
			expect(adminNotifications[0].actionUrl).toBe(`/g/${turn.gameId}`);
		});
	});
});
