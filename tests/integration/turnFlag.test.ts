import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { prisma } from '$lib/server/prisma';
import type { Player, Turn } from '@prisma/client';
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

describe('Turn Flag Functionality', () => {
	let players: Player[] = [];
	let defaultConfig: GameConfig;
	let firstTurn: Turn;

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
		defaultConfig = await replaceDefaultConfig(testConfig);
	});

	// Setup test config
	beforeEach(async () => {
		firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
		await GameUseCases.completeTurn(firstTurn.id, 'writing', 'offensive sentence');
	});

	// Close connection when all tests are done
	afterAll(async () => {
		await replaceDefaultConfig(defaultConfig);
		console.log('🧪 Restored default config');
	});

	describe('Player flagging', () => {
		it('player can flag a turn and only admin can see the game', async () => {
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'spam',
				'Test flag explanation'
			);

			expect(flag).toBeDefined();
			expect(flag.turnId).toBe(firstTurn.id);
			expect(flag.playerId).toBe(players[1].id);
			expect(flag.reason).toBe('spam');
			expect(flag.explanation).toBe('Test flag explanation');
			expect(flag.resolvedAt).toBeNull();

			expect(await GameUseCases.findGameById(firstTurn.gameId)).toBeNull();
			expect(await GameUseCases.findGameById(firstTurn.gameId)).toBeNull();
		});

		it('player cannot create multiple flags on the same turn', async () => {
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag explanation');

			// Try to create another flag - should throw an error
			await expect(() =>
				FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag explanation')
			).rejects.toThrow('Player already has a pending flag');
		});

		it('player can start a new game with a pending flag', async () => {
			const turn2game1 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2game1.gameId).toEqual(firstTurn.gameId);
			// Player flags the first turn
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag explanation');

			// Player starts a second game
			const turn1game2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn1game2.gameId).not.toEqual(firstTurn.gameId);
			await GameUseCases.completeTurn(turn1game2.id, 'writing', '2nd game, first turn');
		});

		it('player cannot create multiple flags on different turns', async () => {
			const turn2game1 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2game1.gameId).toEqual(firstTurn.gameId);
			// Player flags the first turn and their pending turn should be deleted
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag explanation');

			// A second game starts
			const turn1game2 = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			await GameUseCases.completeTurn(turn1game2.id, 'writing', 'dubiously offensive sentence');

			// Our prudish player should get assigned to the same game
			const turn2game2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2game2.gameId).toEqual(turn1game2.gameId);

			// Try to create another flag - should throw an error
			await expect(() =>
				FlagUseCases.flagTurn(turn1game2.id, players[1].id, 'spam', 'Test flag explanation')
			).rejects.toThrow('Player already has a pending flag');
		});
	});

	describe('Admin', () => {
		it('admin can reject a flagged writing turn', async () => {
			// Create a second turn in the game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);

			// Player 1 flags the first turn
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'spam',
				'Test flag explanation'
			);
			expect(flag.resolvedAt).toBeNull();

			// Admin confirms the flag (rejecting the turn)
			const resolvedFlag = await FlagUseCases.confirmFlag(flag.id);
			expect(resolvedFlag.resolvedAt).not.toBeNull();

			// Verify the turn is rejected
			const rejectedTurn = await prisma.turn.findUnique({
				where: { id: firstTurn.id }
			});
			expect(rejectedTurn?.rejectedAt).not.toBeNull();

			// Verify the flag is resolved
			const updatedFlag = await prisma.turnFlag.findUnique({
				where: { id: flag.id }
			});
			expect(updatedFlag?.resolvedAt).not.toBeNull();

			// Players should be able to see the game again, but the rejected turn should be filtered out
			const gameForPlayer = await GameUseCases.findGameById(firstTurn.gameId);
			expect(gameForPlayer).not.toBeNull();
			expect(gameForPlayer?.turns.length).toBe(0);

			// A new player should be matched to the same game but not see the rejected turn or the aborted turn
			const turn2b = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			expect(turn2b.gameId).toEqual(firstTurn.gameId);
			expect(turn2b.isDrawing).toBeFalsy();
		});

		it('admin can reject a flagged drawing turn', async () => {
			// Player 1 creates & completes turn 1
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'offensive drawing');

			// Player 2 creates turn 2
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			expect(turn3.gameId).toEqual(firstTurn.gameId);

			// Player 2 flags turn 1
			const flag = await FlagUseCases.flagTurn(
				turn2.id,
				players[2].id,
				'spam',
				'Test flag explanation'
			);
			expect(flag.resolvedAt).toBeNull();

			// Admin confirms the flag (rejecting the turn)
			const resolvedFlag = await FlagUseCases.confirmFlag(flag.id);
			expect(resolvedFlag.resolvedAt).not.toBeNull();

			// Verify the turn is rejected
			const rejectedTurn = await prisma.turn.findUnique({
				where: { id: turn2.id }
			});
			expect(rejectedTurn?.rejectedAt).not.toBeNull();

			// Verify the flag is resolved
			const updatedFlag = await prisma.turnFlag.findUnique({
				where: { id: flag.id }
			});
			expect(updatedFlag?.resolvedAt).not.toBeNull();

			// Players should be able to see the game again, but the rejected turn should be filtered out
			const gameForPlayer = await GameUseCases.findGameById(firstTurn.gameId);
			expect(gameForPlayer).not.toBeNull();
			expect(gameForPlayer?.turns.length).toBe(1);

			// A new player should be matched to the same game but not see the rejected turn or the aborted turn
			const turn3b = await GameUseCases.createTurnAndMaybeGame(players[3].id);
			expect(turn3b.gameId).toEqual(firstTurn.gameId);
			expect(turn3b.isDrawing).toBeTruthy();
		});

		it('admin can resolve a flagged turn without rejecting it', async () => {
			// Create a second turn in the game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);

			// Player flags the first turn
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'spam',
				'Test flag explanation'
			);
			expect(flag.resolvedAt).toBeNull();

			// Admin rejects the flag (allowing the turn to remain)
			const resolvedFlag = await FlagUseCases.rejectFlag(flag.id);

			// Verify the flag is resolved
			expect(resolvedFlag.resolvedAt).not.toBeNull();

			// Verify the turn is NOT rejected
			const notRejectedTurn = await prisma.turn.findUnique({
				where: { id: firstTurn.id }
			});
			expect(notRejectedTurn?.rejectedAt).toBeNull();

			// Players should be able to see the game again
			const gameForPlayer = await GameUseCases.findGameById(firstTurn.gameId);
			expect(gameForPlayer).not.toBeNull();
			expect(gameForPlayer?.turns.length).toBe(1);

			// A new player should be matched to the same game and see the original turn
			const turn2b = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			expect(turn2b.gameId).toEqual(firstTurn.gameId);
			expect(turn2b.isDrawing).toBeTruthy();
		});

		it('when flag is rejected, flagger should NOT continue in the same game', async () => {
			// Player 1 completes first turn
			// Player 2 gets a turn in the same game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);

			// Player 2 flags Player 1's turn (this should delete Player 2's pending turn)
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'spam',
				'Test flag explanation'
			);

			// Verify Player 2's pending turn was deleted
			const deletedTurn = await prisma.turn.findUnique({
				where: { id: turn2.id }
			});
			expect(deletedTurn).toBeNull();

			// Admin rejects the flag (allowing the original turn to remain)
			await FlagUseCases.rejectFlag(flag.id);

			// Player 2 should NOT be able to get a turn in the same game anymore
			// They should be assigned to a different game or start a new one
			const newTurn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(newTurn2.gameId).not.toEqual(firstTurn.gameId); // Should be a different game
		});

		it('when flag is confirmed, flagger should NOT continue in the same game', async () => {
			// Player 1 completes first turn
			// Player 2 gets a turn in the same game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);

			// Player 2 flags Player 1's turn (this should delete Player 2's pending turn)
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'spam',
				'Test flag explanation'
			);

			// Verify Player 2's pending turn was deleted
			const deletedTurn = await prisma.turn.findUnique({
				where: { id: turn2.id }
			});
			expect(deletedTurn).toBeNull();

			// Admin confirms the flag (rejecting the original turn)
			await FlagUseCases.confirmFlag(flag.id);

			// Player 2 should NOT be able to get a turn in the same game anymore
			// They should be assigned to a different game or start a new one
			const newTurn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(newTurn2.gameId).not.toEqual(firstTurn.gameId); // Should be a different game
		});

		it('other players can continue playing after flag is resolved, but not the flagger', async () => {
			// Player 1 completes first turn
			// Player 2 gets a turn in the same game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toEqual(firstTurn.gameId);

			// Player 2 flags Player 1's turn (this deletes Player 2's pending turn)
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'spam',
				'Test flag explanation'
			);

			// Admin rejects the flag (allowing the original turn to remain)
			await FlagUseCases.rejectFlag(flag.id);

			// Player 2 (the flagger) should NOT be able to get a turn in the same game
			const newTurn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(newTurn2.gameId).not.toEqual(firstTurn.gameId); // Should be a different game

			// Player 3 should be able to join the original game and see the restored turn
			const turn3 = await GameUseCases.createTurnAndMaybeGame(players[2].id);
			expect(turn3.gameId).toEqual(firstTurn.gameId);
			expect(turn3.isDrawing).toBeTruthy(); // Should be drawing after Player 1's writing turn
		});
	});
});
