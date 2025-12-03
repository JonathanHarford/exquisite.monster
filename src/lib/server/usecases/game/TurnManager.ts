import { prisma } from '$lib/server/prisma';
import { type Prisma } from '@prisma/client';
import type { GameWithTurns, Turn } from '$lib/types/domain';
import { toDomainTurn, toDomainGameWithTurns } from '$lib/types/domain';
import { logger } from '$lib/server/logger';
import { turnInclude, gameInclude } from '../../services/gameService';
import { scheduleTurnExpiration, scheduleGameExpiration } from '../../queues/expirationQueue';
import { parseDuration } from '$lib/datetime';
import { GameFinder } from './GameFinder';
import { fetchDefaultGameConfig } from '../../services/configService';
import { GameUseCases } from '../GameUseCases';

export class TurnManager {
	static async createTurn(
		playerId: string,
		game: GameWithTurns,
		options: {
			tx?: Prisma.TransactionClient;
			createdAt?: Date;
		} = {}
	): Promise<Turn> {
		const { tx = prisma, createdAt } = options;
		const now = createdAt ?? new Date();

		const orderIndex = await tx.turn.count({ where: { gameId: game.id } });

		// Calculate isDrawing based on completed, non-rejected turns
		const completedNonRejectedTurns = await tx.turn.count({
			where: {
				gameId: game.id,
				completedAt: { not: null },
				rejectedAt: null
			}
		});
		const isDrawing = completedNonRejectedTurns % 2 === 1;
		const expiresAt = isDrawing
			? new Date(now.valueOf() + parseDuration(game.config.drawingTimeout))
			: new Date(now.valueOf() + parseDuration(game.config.writingTimeout));
		const id = `t_${game.id.slice(2)}_${orderIndex}`;
		const t = await tx.turn.create({
			data: {
				id,
				gameId: game.id,
				playerId,
				content: '',
				isDrawing,
				createdAt: now,
				expiresAt,
				orderIndex
			},
			include: turnInclude
		});

		const turn = toDomainTurn(t);

		// Schedule expiration only if not in transaction (to avoid network I/O during transaction)
		if (tx === prisma) {
			await scheduleTurnExpiration(turn);
		}

		logger.info(`C ${id} expires at: ${expiresAt.toISOString()}`);
		return turn;
	}

	static async completeTurn(
		id: string,
		type: 'writing' | 'drawing',
		content: string
	): Promise<Turn> {
		const game = await GameFinder.findGameByTurnId(id);
		if (!game) {
			throw new Error('Game not found');
		}
		if (game.completedAt) {
			throw new Error('Game already completed');
		}
		// Find the recent turn by ID instead of using completedCount index
		// since game.turns is filtered to exclude rejected turns but completedCount includes them
		const recentTurn = game.turns.find((turn) => turn.id === id && turn.completedAt === null);
		if (!recentTurn) {
			throw new Error('No turns to complete, turn not found or already completed: ' + id);
		}
		if (type === 'writing' && recentTurn.isDrawing) {
			throw new Error('Turn is a drawing, not a writing');
		}
		if (type === 'drawing' && !recentTurn.isDrawing) {
			throw new Error('Turn is a writing, not a drawing');
		}
		if (await this.deleteTurnIfExpired(recentTurn.id)) {
			throw new Error('Turn expired');
		}
		const now = new Date();
		const dbTurn = await prisma.$transaction(async (tx) => {
			let updatedTurn;
			try {
				updatedTurn = await tx.turn.update({
					where: { id, completedAt: null },
					data: {
						content,
						completedAt: now,
						expiresAt: null
					},
					include: {
						flags: true
					}
				});
			} catch {
				throw `Can't complete non-pending turn ${id}`;
			}

			const shouldCompleteGame = game.config.maxTurns
				? updatedTurn.orderIndex >= game.config.maxTurns - 1
				: false;
			if (shouldCompleteGame) {
				await tx.game.update({
					where: { id: game.id },
					data: { completedAt: now }
				});
				logger.info(`Completed game ${game.id}`);
			} else {
				const newExpiresAt = new Date(now.valueOf() + parseDuration(game.config.gameTimeout));
				await tx.game.update({
					where: { id: game.id },
					data: { expiresAt: newExpiresAt }
				});
				await scheduleGameExpiration({ ...game, expiresAt: newExpiresAt });
				logger.info(`Extended game ${game.id}`);
			}

			return updatedTurn;
		});

		// Check if game was completed and create notifications outside the transaction
		const shouldCompleteGame = game.config.maxTurns
			? dbTurn.orderIndex >= game.config.maxTurns - 1
			: false;

		if (shouldCompleteGame) {
			await GameUseCases.handleGameCompletion(game.id, game.seasonId);
		} else {
			const completedTurn = toDomainTurn(dbTurn);
			await this.handlePartyTurnAssignment(completedTurn);
		}

		logger.info(`Completed ${id}: ${content}`);
		return toDomainTurn(dbTurn);
	}

	private static async handlePartyTurnAssignment(completedTurn: Turn): Promise<void> {
		try {
			// Import PartyUseCases dynamically to avoid circular dependency
			const { PartyUseCases } = await import('../PartyUseCases');
			await PartyUseCases.processTurnCompletion(completedTurn);
		} catch (error) {
			logger.error('Failed to process party turn assignment', error);
			// Don't throw - let the turn completion succeed even if party assignment fails
		}
	}

	static async deleteTurnIfExpired(turnId: string): Promise<boolean> {
		const turn = await GameFinder.findTurnById(turnId);
		if (!turn) {
			logger.info(`Turn ${turnId} no longer exists`);
			return false;
		}
		const now = new Date();
		if (turn.expiresAt) {
			if (turn.expiresAt < now) {
				// If this is the first turn (orderIndex 0), mark the entire game as deleted
				if (turn.orderIndex === 0) {
					await GameUseCases.deleteGame(turn.gameId);
					logger.info(`D ${turn.gameId} (first turn expired)`);
				} else {
					await prisma.turn.delete({
						where: { id: turn.id }
					});
					logger.info(`D ${turn.id} (expired)`);
				}
				return true;
			} else {
				// Shouldn't happen?
				// logger.debug(`Rescheduling turn ${turn.id} expiration in ${turn.expiresAt.getTime() - Date.now()}ms`);
				await scheduleTurnExpiration(turn);
			}
		}
		return false;
	}

	static async createTurnAndMaybeGame(
		playerId: string,
		options?: { isLewd?: boolean; turnType?: 'first' | 'writing' | 'drawing' }
	): Promise<Turn> {
		const pendingGame = await GameFinder.findPendingGameByPlayerId(playerId);
		if (pendingGame) {
			throw new Error('Pending game found');
		}

		const { isLewd, turnType } = options ?? {};

		let game: GameWithTurns | null = null;

		if (turnType === 'first') {
			logger.info(`'first' turnType requested, creating new game for player ${playerId}`);
			try {
				const config = await fetchDefaultGameConfig();
				game = await GameUseCases.createGame(config, undefined, isLewd ?? false);
			} catch (error) {
				logger.error('Failed to create game', error, { playerId });
				throw error;
			}
		} else {
			logger.info(
				`Attempting to find available game for player ${playerId}${isLewd !== undefined ? ` (isLewd: ${isLewd})` : ''}${turnType ? ` (type: ${turnType})` : ''}`
			);

			const candidateGames = await prisma.game.findMany({
				where: {
					completedAt: null,
					deletedAt: null,
					...(isLewd !== undefined && { config: { isLewd: isLewd } }),
					AND: [
						{
							turns: {
								none: {
									playerId // Current player has not played in this game
								}
							}
						},
						{
							// Don't match to games with unresolved flagged turns
							turns: {
								none: {
									flags: {
										some: {
											resolvedAt: null
										}
									}
								}
							}
						},
						{
							// Don't match to games where this player has previously flagged any turn
							turns: {
								none: {
									flags: {
										some: {
											playerId
										}
									}
								}
							}
						},
						{
							// Only match to games where ALL existing turns are completed
							turns: {
								none: {
									completedAt: null
								}
							}
						}
					]
				},
				orderBy: { createdAt: 'asc' },
				include: gameInclude
			});

			if (candidateGames.length > 0) {
				for (const candidate of candidateGames) {
					const completedTurnsCount = candidate.turns.filter(
						(turn) => turn.completedAt !== null && turn.rejectedAt === null
					).length;

					if (candidate.config.maxTurns && completedTurnsCount >= candidate.config.maxTurns) {
						continue; // Skip full game
					}

					const nextTurnIsDrawing = completedTurnsCount % 2 === 1;

					if (!turnType) {
						// 'any' turn
						game = toDomainGameWithTurns(candidate);
						break;
					} else if (turnType === 'writing' && !nextTurnIsDrawing) {
						game = toDomainGameWithTurns(candidate);
						break;
					} else if (turnType === 'drawing' && nextTurnIsDrawing) {
						game = toDomainGameWithTurns(candidate);
						break;
					}
				}
			}

			if (game) {
				logger.info(`Joining existing game ${game.id} for player ${playerId}`);
			} else {
				logger.info(
					`No available game found, creating new game for player ${playerId}${isLewd !== undefined ? ` (isLewd: ${isLewd})` : ''}`
				);
				try {
					const config = await fetchDefaultGameConfig();
					game = await GameUseCases.createGame(config, undefined, isLewd ?? false);
				} catch (error) {
					logger.error('Failed to create game', error, { playerId });
					throw error;
				}
			}
		}

		if (!game) {
			throw new Error('Unable to find or create game');
		}

		const turn = await prisma.$transaction(
			async (tx) => {
				return await this.createTurn(playerId, game!, { tx });
			},
			{
				isolationLevel: 'ReadCommitted',
				timeout: 5000 // Short timeout for simple operation
			}
		);

		// Schedule expiration outside transaction to avoid network I/O blocking
		await scheduleTurnExpiration(turn);

		return turn;
	}
}
