import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { GameUseCases } from '../../src/lib/server/usecases/GameUseCases';
import { prisma } from '$lib/server/prisma';
import { type Player } from '$lib/types/domain';
import { getPlayers, deleteAllGames } from './helpers';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';

/**
 * Helper to create a game with a specific number of completed turns
 * @param playerId - Player who will NOT be in this game (so they can join it)
 * @param completedTurns - Number of completed turns (0 = just started, 1 = first turn done, etc.)
 * @param isLewd - Whether the game is 18+
 * @returns Game ID
 */
async function createGameWithTurns(
	playerToExclude: Player,
	completedTurns: number,
	isLewd: boolean
): Promise<string> {
	// Create a game with unique ID and inline config
	const now = new Date();
	const randomSuffix = Math.random().toString(36).substring(2, 8);
	const gameId = `g_${now.valueOf().toString(36)}_${randomSuffix}`;
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

	const game = await prisma.game.create({
		data: {
			id: gameId,
			expiresAt,
			config: {
				create: {
					id: gameId, // Use game ID as config ID to ensure uniqueness
					minTurns: 2,
					maxTurns: 6,
					writingTimeout: '5 minutes',
					drawingTimeout: '15 minutes',
					gameTimeout: '7 days',
					isLewd
				}
			}
		}
	});

	// Create completed turns from other players
	// We need players who are NOT the playerToExclude
	const allUsers = await AdminUseCases.getPlayerList();
	const availablePlayers = allUsers.filter((p) => p.id !== playerToExclude.id);

	for (let i = 0; i < completedTurns; i++) {
		const player = availablePlayers[i % availablePlayers.length];
		const isDrawing = i % 2 === 1; // Even turns are writing, odd are drawing
		const turnId = `t_${game.id.slice(2)}_${i}`;

		await prisma.turn.create({
			data: {
				id: turnId,
				gameId: game.id,
				playerId: player.id,
				completedAt: new Date(),
				orderIndex: i,
				content: `Test content ${i}`,
				isDrawing
			}
		});
	}

	return game.id;
}

describe('/play Page Button States', () => {
	let players: Player[] = [];
	let hlcPlayer: Player;
	let nonHlcPlayer: Player;

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);

		// Use first player as HLC, second as non-HLC
		hlcPlayer = players[0];
		nonHlcPlayer = players[1];

		// Ensure HLC player has hideLewdContent enabled (this makes them HLC)
		await prisma.player.update({
			where: { id: hlcPlayer.id },
			data: { hideLewdContent: true }
		});

		// Ensure non-HLC player has hideLewdContent disabled AND is over 18
		const adultBirthday = new Date();
		adultBirthday.setFullYear(adultBirthday.getFullYear() - 25); // 25 years old

		await prisma.player.update({
			where: { id: nonHlcPlayer.id },
			data: {
				hideLewdContent: false,
				birthday: adultBirthday
			}
		});
	});

	beforeEach(async () => {
		// Clean up games before each test
		await deleteAllGames();
	});

	afterAll(async () => {
		await deleteAllGames();
	});

	describe('HLC Player', () => {
		it('1.1: No available games - only [Play], [n], [l] enabled', async () => {
			const result = await GameUseCases.checkAvailableGameTypes(hlcPlayer.id);

			expect(result).toEqual({
				writingSafe: false,
				writingLewd: false,
				drawingSafe: false,
				drawingLewd: false
			});
		});

		it('1.2: Game needing writing (last turn was picture) - [Play], [w], [n], [l] enabled', async () => {
			// Create game with 2 completed turns (turn 0 = writing, turn 1 = drawing), so next turn is writing
			await createGameWithTurns(hlcPlayer, 2, false);

			const result = await GameUseCases.checkAvailableGameTypes(hlcPlayer.id);

			expect(result).toEqual({
				writingSafe: true,
				writingLewd: false,
				drawingSafe: false,
				drawingLewd: false
			});
		});

		it('1.3: Game needing drawing (last turn was writing) - [Play], [p], [n], [l] enabled', async () => {
			// Create game with 0 completed turns, so next turn is writing (turn 0)
			// Then complete that turn so we need a drawing
			const gameId = await createGameWithTurns(hlcPlayer, 0, false);

			// Add the first turn (writing) to make next turn drawing
			const otherPlayer = players.find((p) => p.id !== hlcPlayer.id)!;
			const turnId = `t_${gameId.slice(2)}_0`;
			await prisma.turn.create({
				data: {
					id: turnId,
					gameId,
					playerId: otherPlayer.id,
					completedAt: new Date(),
					orderIndex: 0,
					content: 'Test prompt',
					isDrawing: false
				}
			});

			const result = await GameUseCases.checkAvailableGameTypes(hlcPlayer.id);

			expect(result).toEqual({
				writingSafe: false,
				writingLewd: false,
				drawingSafe: true,
				drawingLewd: false
			});
		});

		it('1.4: Two games (one needing writing, one needing drawing) - [Play], [w], [p], [n], [l] enabled', async () => {
			// Game 1: needs writing (2 completed turns = writing and drawing done)
			await createGameWithTurns(hlcPlayer, 2, false);

			// Game 2: needs drawing (0 completed turns, then add writing turn)
			const game2Id = await createGameWithTurns(hlcPlayer, 0, false);
			const otherPlayer = players.find((p) => p.id !== hlcPlayer.id)!;
			const turn2Id = `t_${game2Id.slice(2)}_0`;
			await prisma.turn.create({
				data: {
					id: turn2Id,
					gameId: game2Id,
					playerId: otherPlayer.id,
					completedAt: new Date(),
					orderIndex: 0,
					content: 'Test prompt',
					isDrawing: false
				}
			});

			const result = await GameUseCases.checkAvailableGameTypes(hlcPlayer.id);

			expect(result).toEqual({
				writingSafe: true,
				writingLewd: false,
				drawingSafe: true,
				drawingLewd: false
			});
		});
	});

	describe('Non-HLC Player', () => {
		it('2.1: No available games - [Play], [n], [l], [N], [L] enabled', async () => {
			const result = await GameUseCases.checkAvailableGameTypes(nonHlcPlayer.id);

			expect(result).toEqual({
				writingSafe: false,
				writingLewd: false,
				drawingSafe: false,
				drawingLewd: false
			});
		});

		it('2.2: Game needing writing (last turn was picture) - [Play], [w], [n], [l], [W], [N], [L] enabled', async () => {
			// Create safe game needing writing (2 completed turns = writing and drawing done)
			await createGameWithTurns(nonHlcPlayer, 2, false);

			const result = await GameUseCases.checkAvailableGameTypes(nonHlcPlayer.id);

			expect(result).toEqual({
				writingSafe: true,
				writingLewd: false,
				drawingSafe: false,
				drawingLewd: false
			});
		});

		it('2.3: Game needing drawing (last turn was writing) - [Play], [p], [n], [l], [P], [N], [L] enabled', async () => {
			// Create safe game needing drawing
			const gameId = await createGameWithTurns(nonHlcPlayer, 0, false);
			const otherPlayer = players.find((p) => p.id !== nonHlcPlayer.id)!;
			const turnId = `t_${gameId.slice(2)}_0`;
			await prisma.turn.create({
				data: {
					id: turnId,
					gameId,
					playerId: otherPlayer.id,
					completedAt: new Date(),
					orderIndex: 0,
					content: 'Test prompt',
					isDrawing: false
				}
			});

			const result = await GameUseCases.checkAvailableGameTypes(nonHlcPlayer.id);

			expect(result).toEqual({
				writingSafe: false,
				writingLewd: false,
				drawingSafe: true,
				drawingLewd: false
			});
		});

		it('2.4: Two games (safe writing + lewd drawing) - All buttons enabled', async () => {
			// Game 1: Safe game needing writing (2 completed turns)
			await createGameWithTurns(nonHlcPlayer, 2, false);

			// Game 2: Lewd game needing drawing
			const game2Id = await createGameWithTurns(nonHlcPlayer, 0, true);
			const otherPlayer = players.find((p) => p.id !== nonHlcPlayer.id)!;
			const turn2Id = `t_${game2Id.slice(2)}_0`;
			await prisma.turn.create({
				data: {
					id: turn2Id,
					gameId: game2Id,
					playerId: otherPlayer.id,
					completedAt: new Date(),
					orderIndex: 0,
					content: 'Test prompt',
					isDrawing: false
				}
			});

			const result = await GameUseCases.checkAvailableGameTypes(nonHlcPlayer.id);

			expect(result).toEqual({
				writingSafe: true,
				writingLewd: false,
				drawingSafe: false,
				drawingLewd: true
			});
		});
	});
});
