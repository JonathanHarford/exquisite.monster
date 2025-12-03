import { prisma } from '$lib/server/prisma';
import type { Season, SeasonPlayer, GameWithTurns, Turn } from '$lib/types/domain';
import {
	createParty,
	getPartyById,
	getPartyPlayers,
	acceptInvitation,
	invitePlayersToParty,
	getJoinedPlayerCount,
	activateParty,
	canPlayerCreateParty,
	updatePartySettings,
} from '../../services/partyService';
import { createNotification } from '../../services/notificationService';
import { schedulePartyDeadline } from '../../queues/expirationQueue';
import { logger } from '$lib/server/logger';
import {
	assignNextTurnRoundRobin,
	assignNextTurnAlgorithmic,
} from '../../logic/turnAssignment';

interface CreatePartyOptions {
	title: string;
	minPlayers: number;
	maxPlayers: number;
	startDeadline: Date | null;
	turnPassingAlgorithm: 'round-robin' | 'algorithmic';
	allowPlayerInvites: boolean;
	isLewd: boolean;
	invitedPlayerIds: string[];
}

export class PartyManager {
	static async canPlayerCreateParty(playerId: string): Promise<boolean> {
		return await canPlayerCreateParty(playerId);
	}

	static async openParty(creatorId: string, options: CreatePartyOptions): Promise<Season> {
		logger.info(`Opening new party`, { creatorId, title: options.title });

		try {
			const party = await createParty({
				...options,
				creatorId,
				invitedPlayerIds: options.invitedPlayerIds
			});

			await this.notifyInvitedPlayers(party.id, options.invitedPlayerIds);

			if (options.startDeadline) {
				await schedulePartyDeadline(party.id, options.startDeadline);
				logger.info(`Scheduled party deadline for ${party.id} at ${options.startDeadline}`);
			}

			logger.info(`Party opened successfully`, { partyId: party.id });
			return party;
		} catch (error) {
			logger.error('Failed to open party', error);
			console.error('Detailed error during party creation:', error);
			console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
			console.error('Error message:', error instanceof Error ? error.message : String(error));
			throw new Error(
				`Failed to create party: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	static async acceptPartyInvitation(seasonId: string, playerId: string): Promise<boolean> {
		logger.info(`Processing party invitation acceptance`, { seasonId, playerId });

		try {
			const success = await acceptInvitation(seasonId, playerId);
			if (!success) return false;

			// Party activation now only happens via manual start by creator/admin
			// No automatic activation on player join

			return true;
		} catch (error) {
			logger.error('Failed to accept party invitation', error);
			return false;
		}
	}

	static async adminJoinPlayerToParty(
		seasonId: string,
		playerId: string,
		adminId: string
	): Promise<boolean> {
		logger.info(`Admin joining player to party`, { seasonId, playerId, adminId });

		try {
			const admin = await prisma.player.findUnique({
				where: { id: adminId },
				select: { isAdmin: true }
			});

			if (!admin?.isAdmin) {
				logger.warn('Non-admin user attempted to admin join player', {
					adminId,
					seasonId,
					playerId
				});
				return false;
			}

			const success = await acceptInvitation(seasonId, playerId);
			if (!success) return false;

			// Party activation now only happens via manual start by creator/admin
			// No automatic activation on player join

			logger.info(`Admin successfully joined player to party`, { seasonId, playerId, adminId });
			return true;
		} catch (error) {
			logger.error('Failed to admin join player to party', error);
			return false;
		}
	}

	static async invitePlayersToExistingParty(
		seasonId: string,
		playerIds: string[],
		invitingPlayerId: string
	): Promise<boolean> {
		logger.info(`Inviting additional players to party`, { seasonId, playerIds, invitingPlayerId });

		try {
			const success = await invitePlayersToParty(seasonId, playerIds, invitingPlayerId);
			if (!success) return false;

			await this.notifyInvitedPlayers(seasonId, playerIds);

			return true;
		} catch (error) {
			logger.error('Failed to invite players to party', error);
			return false;
		}
	}

	static async startParty(seasonId: string, userId: string): Promise<void> {
		try {
			const party = await getPartyById(seasonId);
			if (!party) {
				throw new Error('Party not found');
			}

			if (party.status !== 'open') {
				throw new Error('Party is not open for starting');
			}

			const player = await prisma.player.findUnique({
				where: { id: userId },
				select: { isAdmin: true }
			});

			const isCreator = party.createdBy === userId;
			const isAdmin = player?.isAdmin === true;

			if (!isCreator && !isAdmin) {
				throw new Error('Only the party creator or an admin can start the party');
			}

			await this.activatePartyInternal(seasonId);
		} catch (error) {
			logger.error('Failed to start party manually', { seasonId, userId, error });
			throw error;
		}
	}

	private static async activatePartyInternal(seasonId: string): Promise<void> {
		logger.info(`Activating party`, { seasonId });

		try {
			const partyPlayers = await getPartyPlayers(seasonId);
			const joinedPlayers = partyPlayers.filter((p) => p.joinedAt !== null);

			const playerPreferences = await prisma.player.findMany({
				where: {
					id: { in: joinedPlayers.map((p) => p.playerId) }
				},
				select: {
					id: true,
					hideLewdContent: true
				}
			});

			// Set isLewd to true only if ALL players have hideLewdContent set to false
			const allPlayersAllowLewd = playerPreferences.every((p) => !p.hideLewdContent);

			logger.info(`Checking lewd content preferences`, {
				seasonId,
				playerCount: playerPreferences.length,
				allPlayersAllowLewd,
				playerPrefs: playerPreferences.map((p) => ({ id: p.id, hideLewd: p.hideLewdContent }))
			});

			const success = await activateParty(seasonId);
			if (!success) return;

			if (allPlayersAllowLewd) {
				await prisma.season.update({
					where: { id: seasonId },
					data: {
						gameConfig: {
							update: {
								isLewd: true
							}
						}
					}
				});
				logger.info(`Party set to lewd mode - all players allow lewd content`, { seasonId });
			}

			const createdAt = new Date();
			await this.createPartyGames(seasonId, joinedPlayers, createdAt);

			logger.info(`Party activated successfully`, {
				seasonId,
				playerCount: joinedPlayers.length,
				isLewd: allPlayersAllowLewd
			});
		} catch (error) {
			logger.error('Failed to activate party', error);
		}
	}

	private static async createPartyGames(
		seasonId: string,
		players: SeasonPlayer[],
		createdAt: Date
	): Promise<void> {
		logger.info(`Creating games for party`, { seasonId, playerCount: players.length });

		try {
			const party = await getPartyById(seasonId);
			if (!party) {
				logger.error('Party not found when creating games', { seasonId });
				return;
			}

			// Dynamic import to avoid circular dependency
			const { GameUseCases } = await import('../GameUseCases');

			const playerIds = players.map((p) => p.playerId);
			const gameIds: string[] = [];

			logger.info(`About to create ${playerIds.length} games for players`, { playerIds });

			for (let i = 0; i < playerIds.length; i++) {
				const gameCreator = playerIds[i];

				logger.info(`Creating game ${i + 1} for player ${gameCreator}`);

				// Party games have a fixed turn count: each player takes exactly one turn
				const gameConfig = {
					minTurns: playerIds.length,
					maxTurns: playerIds.length,
					writingTimeout: party.gameConfig.writingTimeout,
					drawingTimeout: party.gameConfig.drawingTimeout,
					gameTimeout: '365d', // 1 year - effectively no timeout for party games
					isLewd: party.gameConfig.isLewd
				};

				const game = await GameUseCases.createGame(
					gameConfig,
					seasonId,
					party.gameConfig.isLewd,
					createdAt
				);
				gameIds.push(game.id);
				logger.info(`Successfully created game ${game.id}`);

				const firstTurn = await GameUseCases.createTurn(gameCreator, game, { createdAt });
				logger.info(`Successfully created first turn ${firstTurn.id} for player ${gameCreator}`);

				await createNotification({
					userId: gameCreator,
					type: 'party_turn_assigned',
					title: 'Your Turn in Party',
					body: `It's your turn to start a game in "${party.title}"`,
					actionUrl: `/play/${firstTurn.id}`
				});
				logger.info(`Sent notification to player ${gameCreator}`);
			}

			logger.info(`Successfully created ${gameIds.length} games for party ${seasonId}`, {
				gameIds
			});
		} catch (error) {
			logger.error('Failed to create party games', error);
			throw error;
		}
	}

	static async activatePartyIfReady(seasonId: string): Promise<void> {
		logger.info(`Checking if party is ready for activation`, { seasonId });

		try {
			const party = await getPartyById(seasonId);
			if (!party || party.status !== 'open') {
				logger.debug('Party not found or not in open status', { seasonId, status: party?.status });
				return;
			}

			const joinedCount = await getJoinedPlayerCount(seasonId);
			const maxPlayers = party.maxPlayers;

			if (joinedCount >= maxPlayers) {
				logger.info(`Activating party - max players reached`, {
					seasonId,
					joinedCount,
					maxPlayers
				});
				await this.activatePartyInternal(seasonId);
				return;
			}

			// Activate if deadline passed and min players reached
			const now = Date.now();
			const deadlinePassed =
				party.startDeadline && party.startDeadline.getTime() <= now;
			const minPlayersReached = joinedCount >= party.minPlayers;

			if (deadlinePassed && minPlayersReached) {
				logger.info(`Activating party - deadline passed with enough players`, {
					seasonId,
					joinedCount,
					minPlayers: party.minPlayers,
					deadline: party.startDeadline
				});
				await this.activatePartyInternal(seasonId);
			}
		} catch (error) {
			logger.error('Failed to check party activation readiness', error);
		}
	}

	static async checkPartyActivation(seasonId: string): Promise<void> {
		return this.activatePartyIfReady(seasonId);
	}

	static async updatePartySettings(
		seasonId: string,
		userId: string,
		settings: {
			title: string;
			minPlayers: number;
			maxPlayers: number;
			startDeadline: Date | null;
			allowPlayerInvites: boolean;
			turnPassingAlgorithm: 'round-robin' | 'algorithmic';
		}
	): Promise<boolean> {
		try {
			const canModify = await this.canUserModifyParty(seasonId, userId);
			if (!canModify) {
				logger.warn('User attempted to modify party without permission', { seasonId, userId });
				return false;
			}

			const party = await getPartyById(seasonId);
			if (!party || party.status !== 'open') {
				logger.warn('Cannot modify party - not in open status', {
					seasonId,
					status: party?.status
				});
				return false;
			}

			if (
				settings.minPlayers < 2 ||
				settings.maxPlayers < settings.minPlayers ||
				settings.maxPlayers > 50
			) {
				logger.warn('Invalid player limits in party settings', settings);
				return false;
			}

			await updatePartySettings(seasonId, settings);

			logger.info('Party settings updated', {
				seasonId,
				userId,
				settings: { ...settings, startDeadline: settings.startDeadline?.toISOString() }
			});
			return true;
		} catch (error) {
			logger.error('Failed to update party settings', error);
			return false;
		}
	}

	static async forceStartParty(seasonId: string, userId: string): Promise<boolean> {
		try {
			await this.startParty(seasonId, userId);
			return true;
		} catch (error) {
			logger.error('Failed to force start party', error);
			return false;
		}
	}

	static async cancelParty(seasonId: string, userId: string): Promise<boolean> {
		try {
			const party = await getPartyById(seasonId);
			if (!party) {
				logger.warn('Cannot cancel party - party not found', { seasonId });
				return false;
			}

			const user = await prisma.player.findUnique({
				where: { id: userId },
				select: { isAdmin: true }
			});

			const isAdmin = user?.isAdmin === true;
			const isCreator = party.createdBy === userId;

			if (!isCreator && !isAdmin) {
				logger.warn('User attempted to cancel party without permission', {
					seasonId,
					userId,
					isCreator,
					isAdmin
				});
				return false;
			}

			await this.sendPartyCancellationNotifications(seasonId, party.title);

			// Import GameUseCases dynamically to avoid circular dependency
			const { GameUseCases } = await import('../GameUseCases');

			await prisma.$transaction(async (tx) => {
				const games = await tx.game.findMany({
					where: { seasonId, deletedAt: null },
					select: { id: true }
				});

				// Soft delete each game (this handles pending turns and queue cleanup)
				for (const game of games) {
					await GameUseCases.softDeleteGame(game.id);
				}

				// Remove the season relationship from games to avoid cascade deletion
				await tx.game.updateMany({
					where: { seasonId },
					data: { seasonId: null }
				});

				await tx.season.delete({
					where: { id: seasonId }
				});
			});

			logger.info('Party cancelled (deleted)', { seasonId, userId, isCreator, isAdmin });
			return true;
		} catch (error) {
			logger.error('Failed to cancel party', error);
			return false;
		}
	}

	static async canUserModifyParty(seasonId: string, userId: string): Promise<boolean> {
		try {
			const user = await prisma.player.findUnique({
				where: { id: userId },
				select: { isAdmin: true }
			});

			if (user?.isAdmin) {
				return true;
			}

			const party = await prisma.season.findUnique({
				where: { id: seasonId },
				select: { createdBy: true }
			});

			return party?.createdBy === userId;
		} catch (error) {
			logger.error('Failed to check party modification permissions', error);
			return false;
		}
	}

	private static async sendPartyCancellationNotifications(
		seasonId: string,
		partyTitle: string
	): Promise<void> {
		try {
			const players = await prisma.playersInSeasons.findMany({
				where: { seasonId },
				select: { playerId: true }
			});

			for (const player of players) {
				await createNotification({
					userId: player.playerId,
					type: 'party_cancelled',
					title: 'Party Cancelled',
					body: `The party "${partyTitle}" has been cancelled by the creator.`,
					data: {
						partyId: seasonId,
						partyTitle
					}
				});
			}

			logger.info(`Sent cancellation notifications to ${players.length} players`, { seasonId });
		} catch (error) {
			logger.error('Failed to send party cancellation notifications', error);
		}
	}

	private static async notifyInvitedPlayers(seasonId: string, playerIds: string[]): Promise<void> {
		try {
			const party = await getPartyById(seasonId);
			if (!party) return;

			const notifications = playerIds.map((playerId) =>
				createNotification({
					userId: playerId,
					type: 'party_invitation',
					title: 'Party Invitation',
					body: `You've been invited to join "${party.title}"`,
					actionUrl: `/s/${seasonId}`
				})
			);

			await Promise.all(notifications);
		} catch (error) {
			logger.error('Failed to notify invited players', error);
		}
	}

	static async getUserActiveParties(playerId: string): Promise<
		Array<{
			id: string;
			title: string;
			status: string;
			createdAt: Date;
			playerCount: number;
			hasPendingTurn: boolean;
		}>
	> {
		try {
			const userParties = await prisma.playersInSeasons.findMany({
				where: {
					playerId: playerId,
					joinedAt: { not: null } // Only parties they've actually joined
				},
				include: {
					season: {
						include: {
							_count: {
								select: {
									players: {
										where: { joinedAt: { not: null } }
									}
								}
							}
						}
					}
				}
			});

			const partiesWithTurnInfo = await Promise.all(
				userParties.map(async (userParty) => {
					const party = userParty.season;

					const pendingTurnsCount = await prisma.turn.count({
						where: {
							playerId: playerId,
							completedAt: null,
							rejectedAt: null,
							game: {
								seasonId: party.id
							}
						}
					});

					return {
						id: party.id,
						title: party.title,
						status: party.status,
						createdAt: party.createdAt,
						playerCount: party._count.players,
						hasPendingTurn: pendingTurnsCount > 0
					};
				})
			);

			return partiesWithTurnInfo.filter(
				(party) => party.status === 'open' || party.status === 'active'
			);
		} catch (error) {
			logger.error('Failed to get user active parties', error);
			return [];
		}
	}

	static async processTurnCompletion(completedTurn: Turn): Promise<void> {
		logger.info(`Processing turn completion for party game`, {
			turnId: completedTurn.id,
			gameId: completedTurn.gameId
		});

		try {
			// Dynamic import to avoid circular dependency
			const { GameUseCases } = await import('../GameUseCases');

			// Use findGameByIdAdmin to get games from active parties (not just completed ones)
			const game = await GameUseCases.findGameByIdAdmin(completedTurn.gameId);
			if (!game || !game.seasonId) {
				logger.debug('Game is not part of a party, skipping party turn assignment');
				return;
			}

			const party = await getPartyById(game.seasonId);
			if (!party) {
				logger.error('Party not found for game', {
					gameId: completedTurn.gameId,
					seasonId: game.seasonId
				});
				return;
			}

			// If game is already completed, no need to assign a new turn
			if (game.completedAt) {
				logger.debug('Game is already completed, skipping party turn assignment');
				return;
			}

			const partyPlayers = await getPartyPlayers(party.id);
			const joinedPlayers = partyPlayers.filter((p) => p.joinedAt !== null);

			if (joinedPlayers.length === 0) {
				logger.error('No joined players found in party', { partyId: party.id });
				return;
			}

			// In an n-player party, a game should complete after n players have played
			const completedTurnsCount = game.turns.filter((turn) => turn.completedAt !== null).length;
			const shouldCompleteGame = completedTurnsCount >= joinedPlayers.length;

			if (shouldCompleteGame) {
				await GameUseCases.completeGame(game.id);
				logger.info(
					`Completed party game ${game.id} after ${completedTurnsCount} turns (${joinedPlayers.length} players)`
				);
				return;
			}

			let allPartyGames: Array<{
				id: string;
				turns: Array<{ playerId: string; isDrawing: boolean; completedAt: Date | null }>;
			}> = [];
			if (party.turnPassingAlgorithm === 'algorithmic') {
				allPartyGames = await prisma.game.findMany({
					where: { seasonId: game.seasonId },
					include: {
						turns: {
							where: { rejectedAt: null }, // Include ALL non-rejected turns (completed + pending)
							orderBy: { orderIndex: 'asc' }
						}
					},
					orderBy: { createdAt: 'asc' }
				});
			}

			const nextPlayerId = this.assignNextTurn(
				party,
				game,
				completedTurn,
				joinedPlayers,
				allPartyGames
			);

			if (nextPlayerId) {
				const nextTurn = await GameUseCases.createTurn(nextPlayerId, game);

				await createNotification({
					userId: nextPlayerId,
					type: 'party_turn_assigned',
					title: 'Your Turn in Party',
					body: `It's your turn in "${party.title}"`,
					actionUrl: `/play/${nextTurn.id}`
				});

				logger.info(`Assigned next turn to player ${nextPlayerId}`, {
					turnId: nextTurn.id,
					gameId: game.id
				});
			}
		} catch (error) {
			logger.error('Failed to process turn completion for party', error);
		}
	}

	private static assignNextTurn(
		party: Season,
		game: GameWithTurns,
		completedTurn: Turn,
		players: SeasonPlayer[],
		allPartyGames: Array<{
			id: string;
			turns: Array<{ playerId: string; isDrawing: boolean; completedAt: Date | null }>;
		}> = []
	): string | null {
		const playerIds = players.map((p) => p.playerId);

		if (party.turnPassingAlgorithm === 'round-robin') {
			const result = assignNextTurnRoundRobin(game.id, completedTurn.playerId, playerIds);
			if (result.error) {
				logger.error('Failed round-robin turn assignment', { error: result.error });
				return null;
			}
			logger.info(`Round-robin assignment: ${completedTurn.playerId} → ${result.nextPlayerId}`);
			return result.nextPlayerId;

		} else if (party.turnPassingAlgorithm === 'algorithmic') {
			const result = assignNextTurnAlgorithmic(
				{
					gameId: game.id,
					seasonId: game.seasonId,
					completedTurnPlayerId: completedTurn.playerId,
					completedTurnOrderIndex: completedTurn.orderIndex
				},
				playerIds,
				allPartyGames
			);

			if (result.log) {
				logger.info(result.log);
			}

			if (result.error) {
				logger.error('Failed algorithmic turn assignment', { error: result.error });
				// Fallback to round-robin if algorithmic fails (though logic handles fallback usually)
				if (!result.nextPlayerId) {
					const fallback = assignNextTurnRoundRobin(game.id, completedTurn.playerId, playerIds);
					return fallback.nextPlayerId;
				}
			}

			if (result.nextPlayerId) {
				logger.info(`Algorithmic assignment: ${completedTurn.playerId} → ${result.nextPlayerId}`);
			}

			return result.nextPlayerId;
		}

		logger.error('Unknown turn passing algorithm', { algorithm: party.turnPassingAlgorithm });
		return null;
	}
}
