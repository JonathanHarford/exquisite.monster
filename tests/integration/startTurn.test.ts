import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { prisma } from '$lib/server/prisma';
import type { Player } from '@prisma/client';
import type { GameConfig } from '$lib/types/domain';
import { getPlayers, replaceDefaultConfig } from './helpers';
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

describe('Start Turn Logic', () => {
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
		// Clean up any existing data
		await prisma.$transaction([
			prisma.turnFlag.deleteMany(),
			prisma.turn.deleteMany(),
			prisma.game.deleteMany()
		]);
	});

	describe('createTurnAndMaybeGame', () => {
		it('should create a new game when no games exist', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);

			expect(turn).toBeDefined();
			expect(turn.playerId).toBe(players[0].id);
			expect(turn.gameId).toBeDefined();
			expect(turn.orderIndex).toBe(0);
			expect(turn.isDrawing).toBe(false); // First turn is always writing
			expect(turn.status).toBe('pending');
		});

		it('should throw error if player already has a pending turn', async () => {
			// Create first turn
			await GameUseCases.createTurnAndMaybeGame(players[0].id);

			// Try to create another turn for same player - should fail
			await expect(GameUseCases.createTurnAndMaybeGame(players[0].id)).rejects.toThrow(
				'Pending game found'
			);
		});

		it('should join existing game when available', async () => {
			// Player 1 creates and completes first turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'first turn');

			// Player 2 should join the same game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);

			expect(turn2.gameId).toBe(turn1.gameId);
			expect(turn2.orderIndex).toBe(1);
			expect(turn2.isDrawing).toBe(true); // Second turn should be drawing
		});

		it('should create new game when existing game has pending turn', async () => {
			// Player 1 creates turn but doesn't complete it
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);

			// Player 2 should create a new game since turn1 is still pending
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);

			expect(turn2.gameId).not.toBe(turn1.gameId); // Different games
			expect(turn2.orderIndex).toBe(0); // First turn in new game
			expect(turn2.isDrawing).toBe(false); // Writing turn (first turn is always writing)
		});

		it('should not allow player to rejoin game they already played in', async () => {
			// Player 1 creates and completes first turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'first turn');

			// Player 2 joins and completes second turn
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'second.png');

			// Player 1 tries to join again - should get new game
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[0].id);

			expect(turn3.gameId).not.toBe(turn1.gameId);
			expect(turn3.orderIndex).toBe(0);
		});

		it('should not match to games with unresolved flags', async () => {
			// Player 1 creates and completes first turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'offensive content');

			// Player 2 joins and flags the turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(turn1.id, players[1].id, 'offensive');

			// Player 3 should get a new game, not the flagged one
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[2].id);

			expect(turn3.gameId).not.toBe(turn1.gameId);
			expect(turn3.orderIndex).toBe(0);
		});

		it('should not match to games where player previously flagged', async () => {
			// Player 1 creates and completes first turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'content');

			// Player 2 joins and flags the turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(turn1.id, players[1].id, 'spam');

			// Admin resolves the flag by rejecting it
			const flags = await prisma.turnFlag.findMany({
				where: { turnId: turn1.id, resolvedAt: null }
			});
			await FlagUseCases.rejectFlag(flags[0].id);

			// Player 2 should still not be able to join this game
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[1].id);

			expect(turn3.gameId).not.toBe(turn1.gameId);
			expect(turn3.orderIndex).toBe(0);
		});

		it('should allow other players to join after flag is resolved', async () => {
			// Player 1 creates and completes first turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'content');

			// Player 2 joins and flags the turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(turn1.id, players[1].id, 'spam');

			// Admin resolves the flag by rejecting it
			const flags = await prisma.turnFlag.findMany({
				where: { turnId: turn1.id, resolvedAt: null }
			});
			await FlagUseCases.rejectFlag(flags[0].id);

			// Player 3 (who didn't flag) should be able to join the original game
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[2].id);

			expect(turn3.gameId).toBe(turn1.gameId);
			expect(turn3.orderIndex).toBe(1);
			expect(turn3.isDrawing).toBe(true);
		});

		it('should create new game when player has completed turn in previous game', async () => {
			// Player 1 creates and completes a turn in first game
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'First game writing');

			// Player 1 should be able to start a new game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			expect(turn2.gameId).not.toBe(turn1.gameId); // Should be a different game
			expect(turn2.playerId).toBe(players[0].id);
			expect(turn2.isDrawing).toBe(false); // Should be writing (first turn)
		});

		it('should handle rapid successive calls after completing a turn', async () => {
			// Player 1 creates and completes a turn in first game
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'First game writing');

			// Immediately try to create another turn (simulating rapid clicking)
			// This should work without throwing an error
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			expect(turn2.gameId).not.toBe(turn1.gameId); // Should be a different game
			expect(turn2.playerId).toBe(players[0].id);
			expect(turn2.isDrawing).toBe(false); // Should be writing (first turn)
		});

		it('should handle case where player has completed turn but database transaction is still processing', async () => {
			// This test simulates the race condition that might be happening in e2e tests
			// Player 1 creates and completes a turn
			const turn1 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn1.id, 'writing', 'First game writing');

			// Verify the turn is actually completed
			const completedTurn = await prisma.turn.findUnique({
				where: { id: turn1.id }
			});
			expect(completedTurn?.completedAt).not.toBeNull();

			// Player should be able to start a new game immediately
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			expect(turn2).toBeDefined();
			expect(turn2.gameId).not.toBe(turn1.gameId);
		});
	});

	describe('findPendingGameByPlayerId', () => {
		it('should return null when player has no pending games', async () => {
			const pendingGame = await GameUseCases.findPendingGameByPlayerId(players[0].id);
			expect(pendingGame).toBeNull();
		});

		it('should return game when player has pending turn', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);

			const pendingGame = await GameUseCases.findPendingGameByPlayerId(players[0].id);
			expect(pendingGame).not.toBeNull();
			expect(pendingGame?.id).toBe(turn.gameId);
		});

		it('should return null when player completed their turn', async () => {
			const turn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
			await GameUseCases.completeTurn(turn.id, 'writing', 'Test writing');

			const pendingGame = await GameUseCases.findPendingGameByPlayerId(players[0].id);
			expect(pendingGame).toBeNull();
		});
	});
});
