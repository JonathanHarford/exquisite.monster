import { prisma } from '$lib/server/prisma';
import { type GameConfig as PrismaGameConfig, type Prisma } from '@prisma/client';
import type { GameWithTurns, Turn } from '$lib/types/domain';
import { toDomainGameWithTurns } from '$lib/types/domain';
import { logger } from '$lib/server/logger';
import { gameInclude } from '../services/gameService';
import { scheduleGameExpiration } from '../queues/expirationQueue';
import { createNotification } from '../services/notificationService';
import { parseDuration } from '$lib/datetime';

// Import delegate classes
import { GameFinder } from './game/GameFinder';
import { TurnManager } from './game/TurnManager';

export class GameUseCases {
	// Delegate finder methods to GameFinder
	static async findGameById(id: string): Promise<GameWithTurns | null> {
		return GameFinder.findGameById(id);
	}

	static async findGameByIdAdmin(id: string): Promise<GameWithTurns | null> {
		return GameFinder.findGameByIdAdmin(id);
	}

	static async findGameByTurnId(turnId: string): Promise<GameWithTurns | null> {
		return GameFinder.findGameByTurnId(turnId);
	}

	static async findGameByTurnIdAdmin(turnId: string): Promise<GameWithTurns | null> {
		return GameFinder.findGameByTurnIdAdmin(turnId);
	}

	static async findTurnById(id: string): Promise<Turn | null> {
		return GameFinder.findTurnById(id);
	}

	static async findPendingGameByPlayerId(playerId: string): Promise<GameWithTurns | null> {
		return GameFinder.findPendingGameByPlayerId(playerId);
	}

	static async findAllPendingTurnsByPlayerId(playerId: string): Promise<Turn[]> {
		return GameFinder.findAllPendingTurnsByPlayerId(playerId);
	}

	static async findAllPendingPartyTurnsByPlayerId(playerId: string): Promise<Turn[]> {
		return GameFinder.findAllPendingPartyTurnsByPlayerId(playerId);
	}

	static async findAllPendingGamesByPlayerId(playerId: string): Promise<GameWithTurns[]> {
		return GameFinder.findAllPendingGamesByPlayerId(playerId);
	}

	static async checkAvailableGameTypes(playerId: string) {
		return GameFinder.checkAvailableGameTypes(playerId);
	}

	static async getGamesForGallery(params: {
		filter: 'best-7' | 'best-30' | 'best-all' | 'latest';
		page: number;
		limit: number;
		userId?: string;
		showLewd?: boolean;
	}) {
		return GameFinder.getGamesForGallery(params);
	}

	// Delegate turn logic to TurnManager
	static async createTurn(
		playerId: string,
		game: GameWithTurns,
		options?: {
			tx?: Prisma.TransactionClient;
			createdAt?: Date;
		}
	): Promise<Turn> {
		return TurnManager.createTurn(playerId, game, options);
	}

	static async completeTurn(
		id: string,
		type: 'writing' | 'drawing',
		content: string
	): Promise<Turn> {
		return TurnManager.completeTurn(id, type, content);
	}

	static async createTurnAndMaybeGame(
		playerId: string,
		options?: { isLewd?: boolean; turnType?: 'first' | 'writing' | 'drawing' }
	): Promise<Turn> {
		return TurnManager.createTurnAndMaybeGame(playerId, options);
	}

	static async deleteTurnIfExpired(turnId: string): Promise<boolean> {
		return TurnManager.deleteTurnIfExpired(turnId);
	}

	// Remaining Game Lifecycle methods
	static async deleteGame(id: string): Promise<void> {
		await this.softDeleteGame(id);
	}

	static async softDeleteGame(id: string): Promise<void> {
		try {
			const game = await prisma.game.findUnique({
				where: { id },
				include: {
					turns: {
						where: {
							completedAt: null,
							rejectedAt: null
						}
					}
				}
			});

			if (!game) {
				logger.warn(`Cannot soft delete game ${id} - game not found`);
				return;
			}

			await this.cancelGameExpirationJobs(id, game.turns.map(t => t.id));

			await prisma.$transaction(async (tx) => {
				if (game.turns.length > 0) {
					await tx.turn.deleteMany({
						where: {
							gameId: id,
							completedAt: null,
							rejectedAt: null
						}
					});
					logger.info(`Hard deleted ${game.turns.length} pending turns for game ${id}`);
				}

				await tx.game.update({
					where: { id },
					data: { deletedAt: new Date() }
				});
			});

			logger.info(`Soft deleted game ${id} and cleaned up ${game.turns.length} pending turns`);
		} catch (error) {
			logger.error(`Failed to soft delete game ${id}:`, error);
			throw error;
		}
	}

	private static async cancelGameExpirationJobs(gameId: string, turnIds: string[]): Promise<void> {
		try {
			const { cancelGameExpiration, cancelTurnExpiration } = await import('../queues/expirationQueue');
			
			await cancelGameExpiration(gameId);

			await Promise.all(turnIds.map(turnId => cancelTurnExpiration(turnId)));
			
			logger.debug(`Cancelled expiration jobs for game ${gameId} and ${turnIds.length} turns`);
		} catch (error) {
			logger.error(`Failed to cancel expiration jobs for game ${gameId}:`, error);
			// Don't throw - queue cleanup failure shouldn't prevent game deletion
		}
	}

	static async completeGame(id: string): Promise<void> {
		// Avoid duplicate notifications
		const existingGame = await prisma.game.findUnique({
			where: { id },
			select: { completedAt: true, seasonId: true }
		});

		if (existingGame?.completedAt) {
			logger.info(`Game ${id} already completed, skipping notification creation`);
			return;
		}

		await prisma.game.update({
			where: { id },
			data: { completedAt: new Date() }
		});
		logger.info(`Completed game ${id}`);

		await this.handleGameCompletion(id, existingGame?.seasonId);
	}

	// Helper to centralize completion logic
	static async handleGameCompletion(gameId: string, seasonId: string | null | undefined): Promise<void> {
		await this.createGameCompletionNotifications(gameId);

		if (seasonId) {
			try {
				const { PartyUseCases } = await import('./PartyUseCases');
				await PartyUseCases.checkAndHandlePartyCompletion(seasonId);
			} catch (error) {
				logger.error('Failed to check party completion after game completion', error);
				// Don't throw - let the game completion succeed even if party completion check fails
			}
		}
	}

	static async resendCompletionNotifications(gameId: string): Promise<void> {
		const gameWithPlayers = await prisma.game.findUnique({
			where: { id: gameId },
			include: {
				turns: {
					where: { completedAt: { not: null } },
					select: { playerId: true },
					distinct: ['playerId']
				}
			}
		});

		if (gameWithPlayers?.turns) {
			const playerIds = gameWithPlayers.turns.map((turn) => turn.playerId);

			for (const playerId of playerIds) {
				try {
					await createNotification({
						userId: playerId,
						type: 'game_completion',
						data: { gameId },
						actionUrl: `/g/${gameId}`,
						templateData: {
							gameId
						}
					});
				} catch (error) {
					logger.error(
						`Failed to create game completion notification for player ${playerId}:`,
						error
					);
				}
			}
			logger.info(`Resent completion notifications for game ${gameId}`);
		}
	}

	private static async createGameCompletionNotifications(gameId: string): Promise<void> {
		const existingNotifications = await prisma.notification.findFirst({
			where: {
				type: 'game_completion',
				data: {
					path: ['gameId'],
					equals: gameId
				}
			}
		});

		if (existingNotifications) {
			logger.info(`Game completion notifications already exist for game ${gameId}, skipping`);
			return;
		}

		const gameWithPlayers = await prisma.game.findUnique({
			where: { id: gameId },
			include: {
				turns: {
					where: { completedAt: { not: null } },
					select: { playerId: true },
					distinct: ['playerId']
				}
			}
		});

		if (gameWithPlayers?.turns) {
			const playerIds = gameWithPlayers.turns.map((turn) => turn.playerId);

			for (const playerId of playerIds) {
				try {
					await createNotification({
						userId: playerId,
						type: 'game_completion',
						data: { gameId },
						actionUrl: `/g/${gameId}`,
						templateData: {
							gameId
						}
					});
				} catch (error) {
					logger.error(
						`Failed to create game completion notification for player ${playerId}:`,
						error
					);
					// Don't fail the game completion if notification creation fails
				}
			}
		}
	}

	static async createGame(
		config: Omit<PrismaGameConfig, 'id' | 'createdAt' | 'updatedAt'>,
		seasonId?: string,
		isLewd: boolean = false,
		createdAt?: Date
	) {
		if (seasonId && !createdAt) {
			// Games in a season should all have the same createdAt date or the grid looks weird
			throw new Error('Season ID provided but no createdAt date');
		}
		const now = createdAt ?? new Date();
		// Add a random suffix to prevent collisions when creating games in rapid succession
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		const id = `g_${now.valueOf().toString(36)}_${randomSuffix}`;
		const data = {
			id,
			config: {
				create: {
					...config,
					id,
					isLewd
				}
			},
			season: seasonId ? { connect: { id: seasonId } } : undefined,
			createdAt: now,
			expiresAt: new Date(now.valueOf() + parseDuration(config.gameTimeout))
		};
		const dbGame = await prisma.game.create({
			data,
			include: gameInclude
		});
		const game = toDomainGameWithTurns(dbGame);
		await scheduleGameExpiration(game);
		logger.info(`C ${game.id}${game.config.isLewd ? ' (18+)' : ''}`);
		return game;
	}

	static async completeGameIfExpired(gameId: string): Promise<void> {
		const existingGame = await this.findGameByIdAdmin(gameId);
		if (!existingGame) {
			logger.info(`Game ${gameId} no longer exists`);
			return;
		}

		if (existingGame.completedAt) {
			logger.info(`Game ${gameId} already completed`);
			return;
		}

		if (!existingGame.expiresAt) {
			logger.warn(`Game ${gameId} has no expiration date`);
			return;
		}

		const now = new Date();
		if (existingGame.expiresAt > now) {
			// logger.debug(`Rescheduling game ${gameId} expiration in ${existingGame.expiresAt.getTime() - now.getTime()}ms`);
			await scheduleGameExpiration(existingGame);
			return;
		}

		// Check if game has enough turns to be completed
		if (existingGame.completedCount >= existingGame.config.minTurns) {
			await this.completeGame(existingGame.id);
			logger.info(`Completed expired game ${gameId}`);
		} else {
			logger.info(
				`Game ${gameId} expired but not enough turns (${existingGame.completedCount}/${existingGame.config.minTurns})`
			);
		}
	}

	// With the queue, we should not need this (except in tests).
	// But let's keep it to use for safety.
	static async performExpirations(): Promise<void> {
		const expiredTurns = await prisma.turn.findMany({
			where: {
				completedAt: null,
				expiresAt: {
					lt: new Date()
				},
				game: {
					deletedAt: null
				}
			}
		});

		for (const turn of expiredTurns) {
			await this.deleteTurnIfExpired(turn.id);
		}

		const expiredGames = await prisma.game.findMany({
			where: {
				completedAt: null,
				deletedAt: null,
				expiresAt: {
					lt: new Date()
				}
			}
		});

		for (const game of expiredGames) {
			await this.completeGameIfExpired(game.id);
		}
	}
}
