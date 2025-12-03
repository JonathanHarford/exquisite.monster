import { prisma } from './prisma';
import { nanoid } from 'nanoid';
import type { Player, Game, Turn } from '@prisma/client';

// E2E-specific use cases that don't depend on SvelteKit's $env imports

export class TestGameUseCases {
	static async createTurnAndMaybeGame(playerId: string): Promise<Turn> {
		// Check if player has any pending turns (turns without completedAt)
		const existingPendingTurn = await prisma.turn.findFirst({
			where: {
				playerId,
				completedAt: null
			}
		});

		if (existingPendingTurn) {
			return existingPendingTurn;
		}

		// Find a game the player hasn't played in yet
		const playedGameIds = await prisma.turn
			.findMany({
				where: { playerId },
				select: { gameId: true }
			})
			.then((turns) => turns.map((t) => t.gameId));

		let game = await prisma.game.findFirst({
			where: {
				id: { notIn: playedGameIds },
				completedAt: null, // Active games don't have completedAt
				deletedAt: null
			}
		});

		// If no suitable game exists, create a new one
		if (!game) {
			const defaultConfig = await prisma.gameConfig.findUnique({
				where: { id: 'default' }
			});

			if (!defaultConfig) {
				throw new Error('Default game config not found');
			}

			const now = new Date();
			const gameId = `g_${now.valueOf().toString(36)}`;
			const expiresAt = new Date(now.valueOf() + defaultConfig.gameTimeout);

			game = await prisma.game.create({
				data: {
					id: gameId,
					config: {
						create: {
							id: gameId,
							minTurns: defaultConfig.minTurns,
							maxTurns: defaultConfig.maxTurns,
							writingTimeout: defaultConfig.writingTimeout,
							drawingTimeout: defaultConfig.drawingTimeout,
							gameTimeout: defaultConfig.gameTimeout
						}
					},
					expiresAt
				}
			});
		}

		// Get the last turn in the game to determine the type
		const lastTurn = await prisma.turn.findFirst({
			where: { gameId: game.id, completedAt: { not: null } },
			orderBy: { createdAt: 'desc' }
		});

		const isDrawing = lastTurn ? !lastTurn.isDrawing : false; // First turn is writing

		// Get the next order index
		const turnCount = await prisma.turn.count({
			where: { gameId: game.id }
		});

		// Create the pending turn
		const turn = await prisma.turn.create({
			data: {
				id: `t_${nanoid(7)}_${Date.now()}`,
				gameId: game.id,
				playerId,
				isDrawing,
				orderIndex: turnCount,
				content: ''
			}
		});

		return turn;
	}

	static async completeTurn(
		turnId: string,
		type: 'writing' | 'drawing',
		content: string
	): Promise<Turn> {
		const turn = await prisma.turn.update({
			where: { id: turnId },
			data: {
				content,
				completedAt: new Date()
			}
		});

		// Check if game should be completed
		const game = await prisma.game.findUnique({
			where: { id: turn.gameId },
			include: {
				config: true,
				turns: {
					where: { completedAt: { not: null } },
					orderBy: { createdAt: 'asc' }
				}
			}
		});

		if (game && game.turns.length >= game.config.minTurns) {
			await prisma.game.update({
				where: { id: game.id },
				data: {
					completedAt: new Date()
				}
			});
		}

		return turn;
	}

	static async findGameById(gameId: string): Promise<Game | null> {
		return prisma.game.findUnique({
			where: { id: gameId }
		});
	}
}

export class TestAdminUseCases {
	static async getPlayerList(): Promise<Player[]> {
		return prisma.player.findMany({
			orderBy: { username: 'asc' }
		});
	}
}
