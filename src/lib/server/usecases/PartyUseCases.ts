import { prisma } from '$lib/server/prisma';
import type { Season, SeasonPlayer, Turn, GameWithTurns, Player } from '$lib/types/domain';
import {
	toDomainPlayer,
	toDomainGameWithTurns
} from '$lib/types/domain';
import {
	getPartyById,
	getPartyPlayers,
	checkPartyCompletion,
	getCompletedPartyGames,
} from '../services/partyService';
import { createNotification } from '../services/notificationService';
import { logger } from '$lib/server/logger';
import { PartyManager } from './party/PartyManager';

export class PartyUseCases {
	// Delegating static methods to PartyManager for backward compatibility and organization
	static async canPlayerCreateParty(playerId: string): Promise<boolean> {
		return PartyManager.canPlayerCreateParty(playerId);
	}

	static async openParty(creatorId: string, options: any): Promise<Season> {
		return PartyManager.openParty(creatorId, options);
	}

	static async acceptPartyInvitation(seasonId: string, playerId: string): Promise<boolean> {
		return PartyManager.acceptPartyInvitation(seasonId, playerId);
	}

	static async adminJoinPlayerToParty(seasonId: string, playerId: string, adminId: string): Promise<boolean> {
		return PartyManager.adminJoinPlayerToParty(seasonId, playerId, adminId);
	}

	static async invitePlayersToExistingParty(seasonId: string, playerIds: string[], invitingPlayerId: string): Promise<boolean> {
		return PartyManager.invitePlayersToExistingParty(seasonId, playerIds, invitingPlayerId);
	}

	static async startParty(seasonId: string, userId: string): Promise<void> {
		return PartyManager.startParty(seasonId, userId);
	}

	static async activatePartyIfReady(seasonId: string): Promise<void> {
		return PartyManager.activatePartyIfReady(seasonId);
	}

	static async checkPartyActivation(seasonId: string): Promise<void> {
		return PartyManager.checkPartyActivation(seasonId);
	}

	static async updatePartySettings(seasonId: string, userId: string, settings: any): Promise<boolean> {
		return PartyManager.updatePartySettings(seasonId, userId, settings);
	}

	static async forceStartParty(seasonId: string, userId: string): Promise<boolean> {
		return PartyManager.forceStartParty(seasonId, userId);
	}

	static async cancelParty(seasonId: string, userId: string): Promise<boolean> {
		return PartyManager.cancelParty(seasonId, userId);
	}

	static async getUserActiveParties(playerId: string): Promise<any[]> {
		return PartyManager.getUserActiveParties(playerId);
	}

	static async processTurnCompletion(completedTurn: Turn): Promise<void> {
		return PartyManager.processTurnCompletion(completedTurn);
	}

	static async getPartyDetails(seasonId: string): Promise<{
		party: Season | null;
		seasonPlayers: SeasonPlayer[];
		players: Player[];
		games: GameWithTurns[];
	}> {
		try {
			const party = await getPartyById(seasonId);
			if (!party) return { party: null, seasonPlayers: [], players: [], games: [] };

			const seasonPlayers = await getPartyPlayers(seasonId);
			const playerIds = seasonPlayers.map((p) => p.playerId);
			const prismaPlayers = await prisma.player.findMany({
				where: { id: { in: playerIds } }
			});
			const players = prismaPlayers.map(toDomainPlayer);

			// Get games for active parties
			let games: GameWithTurns[] = [];
			if (party.status === 'active' || party.status === 'completed') {
				const prismaGames = await prisma.game.findMany({
					where: { seasonId },
					include: {
						config: true,
						turns: {
							include: {
								player: true
							},
							orderBy: { orderIndex: 'asc' }
						}
					},
					orderBy: { createdAt: 'asc' }
				});

				games = prismaGames.map(toDomainGameWithTurns);
			}

			return { party, seasonPlayers, players, games };
		} catch (error) {
			logger.error('Failed to get party details', error);
			return { party: null, seasonPlayers: [], players: [], games: [] };
		}
	}

	static async checkAndHandlePartyCompletion(seasonId: string): Promise<boolean> {
		logger.info(`Checking and handling party completion`, { seasonId });

		try {
			const wasCompleted = await checkPartyCompletion(seasonId);

			if (wasCompleted) {
				await this.sendPartyCompletionNotifications(seasonId);
				logger.info(`Party completion handled successfully`, { seasonId });
			}

			return wasCompleted;
		} catch (error) {
			logger.error('Failed to handle party completion', error);
			return false;
		}
	}

	private static async sendPartyCompletionNotifications(seasonId: string): Promise<void> {
		try {
			const party = await getPartyById(seasonId);
			const players = await getPartyPlayers(seasonId);

			if (!party) return;

			const joinedPlayers = players.filter((p) => p.joinedAt !== null);

			for (const player of joinedPlayers) {
				await createNotification({
					userId: player.playerId,
					type: 'party_completed',
					title: 'Party Completed!',
					body: `The party "${party.title}" has finished! All games are now complete.`,
					actionUrl: `/s/${seasonId}`,
					data: {
						partyId: seasonId,
						partyTitle: party.title
					}
				});
			}

			logger.info(`Sent completion notifications to ${joinedPlayers.length} players`, { seasonId });
		} catch (error) {
			logger.error('Failed to send party completion notifications', error);
		}
	}

	static async getCompletedGamesForParty(
		seasonId: string,
		viewerHidesLewd: boolean = false
	): Promise<GameWithTurns[]> {
		try {
			const games = await getCompletedPartyGames(seasonId, !viewerHidesLewd);
			return games;
		} catch (error) {
			logger.error('Failed to get completed games for party', error);
			return [];
		}
	}

	static async getFavoritePlayersForInvite(
		playerId: string
	): Promise<Array<{ id: string; username: string; imageUrl: string }>> {
		try {
			const favoritePlayerIds = await prisma.playerFavorite.findMany({
				where: { favoritingPlayerId: playerId },
				select: { favoritedPlayerId: true }
			});

			if (favoritePlayerIds.length === 0) {
				return [];
			}

			const favoritePlayers = await prisma.player.findMany({
				where: {
					id: { in: favoritePlayerIds.map((f) => f.favoritedPlayerId) }
				},
				select: {
					id: true,
					username: true,
					imageUrl: true
				},
				orderBy: { username: 'asc' }
			});

			return favoritePlayers;
		} catch (error) {
			logger.error('Failed to get favorite players for invite', error);
			return [];
		}
	}

	static async getPlayerLewdContentPreference(playerId: string): Promise<boolean> {
		try {
			const player = await prisma.player.findUnique({
				where: { id: playerId },
				select: { hideLewdContent: true }
			});
			return player?.hideLewdContent || false;
		} catch (error) {
			logger.error('Failed to get player lewd content preference', error);
			return false;
		}
	}
}
