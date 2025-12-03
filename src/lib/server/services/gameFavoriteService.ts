import { prisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import type { GameWithTurns } from '$lib/types/domain'; // Assuming Game type exists and can be imported
import { toDomainGameWithTurns } from '$lib/types/domain'; // Assuming a transformer for Game

// Function to create a GameFavorite entry
export const favoriteGame = async (playerId: string, gameId: string): Promise<void> => {
	// Prevent potential issues if playerId or gameId is undefined/null
	if (!playerId || !gameId) {
		throw new Error('Player ID and Game ID must be provided.');
	}

	const existingFavorite = await prisma.gameFavorite.findUnique({
		where: {
			playerId_gameId: {
				playerId,
				gameId
			}
		}
	});

	if (existingFavorite) {
		// Optional: throw an error or just return if already favorited
		logger.warn(`Game ${gameId} already favorited by player ${playerId}.`);
		return;
	}

	await prisma.gameFavorite.create({
		data: {
			playerId,
			gameId
		}
	});
	logger.info(`Player ${playerId} favorited game ${gameId}`);
};

// Function to delete a GameFavorite entry
export const unfavoriteGame = async (playerId: string, gameId: string): Promise<void> => {
	if (!playerId || !gameId) {
		throw new Error('Player ID and Game ID must be provided.');
	}

	const existingFavorite = await prisma.gameFavorite.findUnique({
		where: {
			playerId_gameId: {
				playerId,
				gameId
			}
		}
	});

	if (!existingFavorite) {
		// Optional: throw an error or just return if not favorited
		logger.warn(`Game ${gameId} not favorited by player ${playerId}, cannot unfavorite.`);
		return;
	}

	await prisma.gameFavorite.delete({
		where: {
			playerId_gameId: {
				playerId,
				gameId
			}
		}
	});
	logger.info(`Player ${playerId} unfavorited game ${gameId}`);
};

// Function to fetch all games favorited by a player
export const getFavoritedGames = async (playerId: string): Promise<GameWithTurns[]> => {
	if (!playerId) {
		throw new Error('Player ID must be provided.');
	}

	const favorites = await prisma.gameFavorite.findMany({
		where: {
			playerId
		},
		include: {
			game: {
				// Include the full game object
				include: {
					// Also include game config and turns for toDomainGameWithTurns
					config: true,
					turns: {
						include: {
							player: true
						}
					},
					_count: {
						select: {
							favoritedBy: true
						}
					}
				}
			}
		},
		orderBy: {
			createdAt: 'desc'
		}
	});

	// Transform Prisma Game objects to domain Game objects
	return favorites.map((fav) => toDomainGameWithTurns(fav.game));
};

// Function to check if a specific game is favorited by a player
export const isGameFavorited = async (playerId: string, gameId: string): Promise<boolean> => {
	if (!playerId || !gameId) {
		// Depending on desired behavior, could return false or throw error
		logger.warn('Player ID or Game ID not provided for isGameFavorited check.');
		return false;
	}

	const favorite = await prisma.gameFavorite.findUnique({
		where: {
			playerId_gameId: {
				playerId,
				gameId
			}
		}
	});
	return !!favorite;
};

// Function to get the total number of times a game has been favorited
export const getGameFavoriteCount = async (gameId: string): Promise<number> => {
	if (!gameId) {
		throw new Error('Game ID must be provided.');
	}

	return prisma.gameFavorite.count({
		where: {
			gameId
		}
	});
};
