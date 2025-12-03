import { prisma } from '$lib/server/prisma';
import type { Season, SeasonPlayer, GameWithTurns } from '$lib/types/domain';
import { toDomainSeason, toDomainSeasonPlayer, toDomainGameWithTurns } from '$lib/types/domain';
import { logger } from '$lib/server/logger';
import { DAYS, formatDuration } from '$lib/datetime';

export const seasonInclude = {
	gameConfig: true,
	players: true,
	games: true
};

interface CreatePartyData {
	title: string;
	minPlayers: number;
	maxPlayers: number;
	startDeadline: Date | null;
	turnPassingAlgorithm: 'round-robin' | 'algorithmic';
	allowPlayerInvites: boolean;
	isLewd: boolean;
	creatorId: string;
	invitedPlayerIds: string[];
}

/**
 * Checks if a player can create a new party (only one open party at a time)
 */
export const canPlayerCreateParty = async (playerId: string): Promise<boolean> => {
	try {
		// Check if the player has any open parties they created
		const openParty = await prisma.season.findFirst({
			where: {
				createdBy: playerId,
				status: 'open'
			},
			select: { id: true }
		});

		return openParty === null; // Can create if no open party exists
	} catch (error) {
		logger.error('Failed to check if player can create party', error);
		return false; // Fail safe - don't allow creation if we can't check
	}
};

/**
 * Creates a new party (season) with game config and initial player invitations
 */
export const createParty = async (data: CreatePartyData): Promise<Season> => {
	try {
		const result = await prisma.$transaction(async (tx) => {
			// Generate unique IDs with random suffix to prevent collisions
			const now = Date.now();
			const randomSuffix = Math.random().toString(36).substring(2, 8);

			// Create game config for this party
			const gameConfig = await tx.gameConfig.create({
				data: {
					id: `gc_${now.toString(36)}_${randomSuffix}`,
					minTurns: 5, // Default values - can be customized later
					maxTurns: null,
					writingTimeout: formatDuration(7 * DAYS), // 7 days
					drawingTimeout: formatDuration(7 * DAYS), // 7 days
					gameTimeout: formatDuration(7 * DAYS), // 7 days (changed from 30 to avoid overflow)
					isLewd: data.isLewd
				}
			});

			// Create the party (season)
			const season = await tx.season.create({
				data: {
					id: `s_${now.toString(36)}_${randomSuffix}`,
					title: data.title,
					startDeadline: data.startDeadline,
					minPlayers: data.minPlayers,
					maxPlayers: data.maxPlayers,
					turnPassingAlgorithm: data.turnPassingAlgorithm,
					allowPlayerInvites: data.allowPlayerInvites,
					gameConfigId: gameConfig.id,
					createdBy: data.creatorId
				},
				include: seasonInclude
			});

			// Add the creator as an accepted player
			await tx.playersInSeasons.create({
				data: {
					seasonId: season.id,
					playerId: data.creatorId,
					joinedAt: new Date() // Creator is automatically joined
				}
			});

			// Add invited players
			if (data.invitedPlayerIds.length > 0) {
				await tx.playersInSeasons.createMany({
					data: data.invitedPlayerIds.map((playerId) => ({
						seasonId: season.id,
						playerId,
						joinedAt: null // Invited but not yet joined
					}))
				});
			}

			// Fetch the complete season with all relations
			const completeSeason = await tx.season.findUnique({
				where: { id: season.id },
				include: seasonInclude
			});

			return completeSeason!;
		});

		logger.info(`Party created successfully: ${result.id}`);
		return toDomainSeason(result);
	} catch (error) {
		logger.error('Failed to create party', error);
		console.error('Detailed error in createParty service:', error);
		if (error instanceof Error) {
			console.error('Error message:', error.message);
			console.error('Error stack:', error.stack);
		}
		throw new Error(
			`Failed to create party: ${error instanceof Error ? error.message : String(error)}`
		);
	}
};

/**
 * Gets a party by ID with all related data
 */
export const getPartyById = async (id: string): Promise<Season | null> => {
	try {
		const season = await prisma.season.findUnique({
			where: { id },
			include: seasonInclude
		});

		return season ? toDomainSeason(season) : null;
	} catch (error) {
		logger.error('Failed to get party by ID', error);
		return null;
	}
};

/**
 * Gets party players with their invitation/join status
 */
export const getPartyPlayers = async (seasonId: string): Promise<SeasonPlayer[]> => {
	try {
		const players = await prisma.playersInSeasons.findMany({
			where: { seasonId },
			orderBy: { invitedAt: 'asc' }
		});

		return players.map(toDomainSeasonPlayer);
	} catch (error) {
		logger.error('Failed to get party players', error);
		return [];
	}
};

/**
 * Accepts an invitation to a party
 */
export const acceptInvitation = async (seasonId: string, playerId: string): Promise<boolean> => {
	logger.info(`Player accepting invitation`, { seasonId, playerId });

	try {
		await prisma.playersInSeasons.update({
			where: {
				seasonId_playerId: {
					seasonId,
					playerId
				}
			},
			data: {
				joinedAt: new Date()
			}
		});

		logger.info(`Invitation accepted successfully`, { seasonId, playerId });
		return true;
	} catch (error) {
		logger.error('Failed to accept invitation', error);
		return false;
	}
};

/**
 * Adds new players to an existing party (if allowed)
 */
export const invitePlayersToParty = async (
	seasonId: string,
	playerIds: string[],
	invitingPlayerId: string
): Promise<boolean> => {
	logger.info(`Inviting players to party`, { seasonId, playerIds, invitingPlayerId });

	try {
		// Check if the inviting player is allowed to invite others
		const season = await prisma.season.findUnique({
			where: { id: seasonId },
			include: {
				players: {
					where: { playerId: invitingPlayerId }
				}
			}
		});

		if (!season) {
			logger.error('Season not found', { seasonId });
			return false;
		}

		// Check if the inviting player exists and has joined
		const invitingPlayer = season.players[0];
		if (!invitingPlayer || !invitingPlayer.joinedAt) {
			logger.error('Inviting player not found or not joined', { seasonId, invitingPlayerId });
			return false;
		}

		// Get player info to check if they're creator or admin
		const player = await prisma.player.findUnique({
			where: { id: invitingPlayerId },
			select: { isAdmin: true }
		});

		const isCreator = season.createdBy === invitingPlayerId;
		const isAdmin = player?.isAdmin || false;

		// Check permissions: when allowPlayerInvites is false, only the creator and admin can invite
		if (!isCreator && !isAdmin && !season.allowPlayerInvites) {
			logger.error('Player not authorized to invite others', {
				seasonId,
				invitingPlayerId,
				isCreator,
				isAdmin,
				allowPlayerInvites: season.allowPlayerInvites
			});
			return false;
		}

		// Add the new players as invited
		await prisma.playersInSeasons.createMany({
			data: playerIds.map((playerId) => ({
				seasonId,
				playerId,
				joinedAt: null
			})),
			skipDuplicates: true
		});

		logger.info(`Players invited successfully`, {
			seasonId,
			playerIds,
			invitingPlayerId,
			isCreator,
			isAdmin
		});
		return true;
	} catch (error) {
		logger.error('Failed to invite players to party', error);
		return false;
	}
};

/**
 * Gets the count of joined players for a party
 */
export const getJoinedPlayerCount = async (seasonId: string): Promise<number> => {
	try {
		const count = await prisma.playersInSeasons.count({
			where: {
				seasonId,
				joinedAt: { not: null }
			}
		});

		return count;
	} catch (error) {
		logger.error('Failed to get joined player count', error);
		return 0;
	}
};

/**
 * Activates a party by changing its status and creating games
 */
export const activateParty = async (seasonId: string): Promise<boolean> => {
	logger.info(`Activating party`, { seasonId });

	try {
		await prisma.season.update({
			where: { id: seasonId },
			data: { status: 'active' }
		});

		logger.info(`Party activated successfully`, { seasonId });
		return true;
	} catch (error) {
		logger.error('Failed to activate party', error);
		return false;
	}
};

/**
 * Checks if all games in a party are completed and updates party status if so
 */
export const checkPartyCompletion = async (seasonId: string): Promise<boolean> => {
	logger.info(`Checking party completion`, { seasonId });

	try {
		// Get the party and its games
		const party = await prisma.season.findUnique({
			where: { id: seasonId },
			include: {
				games: {
					select: {
						id: true,
						completedAt: true
					}
				}
			}
		});

		if (!party) {
			logger.warn('Party not found for completion check', { seasonId });
			return false;
		}

		// Only check completion for active parties
		if (party.status !== 'active') {
			return false;
		}

		// Check if all games are completed
		const allGamesCompleted =
			party.games.length > 0 && party.games.every((game) => game.completedAt !== null);

		if (allGamesCompleted) {
			// Update party status to completed
			await prisma.season.update({
				where: { id: seasonId },
				data: {
					status: 'completed',
					updatedAt: new Date()
				}
			});

			logger.info(`Party marked as completed`, { seasonId, gameCount: party.games.length });
			return true;
		}

		return false;
	} catch (error) {
		logger.error('Failed to check party completion', error);
		return false;
	}
};

/**
 * Gets completed games for a finished party with public/private filtering
 */
export const getCompletedPartyGames = async (
	seasonId: string,
	includeLewd: boolean = false
): Promise<GameWithTurns[]> => {
	try {
		const games = await prisma.game.findMany({
			where: {
				seasonId,
				completedAt: { not: null },
				...(includeLewd ? {} : { config: { isLewd: false } })
			},
			include: {
				config: true, // Include config to access isLewd
				turns: {
					where: { completedAt: { not: null } },
					include: {
						player: true
					},
					orderBy: { orderIndex: 'asc' }
				},
				_count: {
					select: {
						favoritedBy: true
					}
				}
			},
			orderBy: { completedAt: 'asc' }
		});

		return games.map((game) => toDomainGameWithTurns(game));
	} catch (error) {
		logger.error('Failed to get completed party games', error);
		return [];
	}
};

/**
 * Update party settings
 */
export const updatePartySettings = async (
	seasonId: string,
	settings: {
		title: string;
		minPlayers: number;
		maxPlayers: number;
		startDeadline: Date | null;
		allowPlayerInvites: boolean;
		turnPassingAlgorithm: 'round-robin' | 'algorithmic';
	}
): Promise<void> => {
	try {
		await prisma.season.update({
			where: { id: seasonId },
			data: {
				title: settings.title,
				minPlayers: settings.minPlayers,
				maxPlayers: settings.maxPlayers,
				startDeadline: settings.startDeadline,
				allowPlayerInvites: settings.allowPlayerInvites,
				turnPassingAlgorithm: settings.turnPassingAlgorithm
			}
		});

		logger.info('Party settings updated successfully', { seasonId });
	} catch (error) {
		logger.error('Failed to update party settings', error);
		throw error;
	}
};

/**
 * Cancel a party and set status to closed
 */
export const cancelParty = async (seasonId: string): Promise<void> => {
	try {
		await prisma.season.update({
			where: { id: seasonId },
			data: { status: 'closed' }
		});

		logger.info('Party cancelled successfully', { seasonId });
	} catch (error) {
		logger.error('Failed to cancel party', error);
		throw error;
	}
};

