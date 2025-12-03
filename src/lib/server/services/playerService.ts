import { prisma } from '$lib/server/prisma';
import type { Player, PlayerWithFavorites } from '$lib/types/domain';
import { toDomainPlayer } from '$lib/types/domain';
import { clerkClient } from 'svelte-clerk/server';
import { logger } from '$lib/server/logger';
import { humanId } from 'human-id';
import { ADMIN_EMAIL } from '$env/static/private';
import { createNotification } from '$lib/server/services/notificationService';

// Simple in-memory cache for player profiles to avoid N+1 queries during a single request cycle
// (or very short window).
interface CachedPlayer {
	data: Player | null;
	expires: number;
}
const playerCache = new Map<string, CachedPlayer>();
const CACHE_TTL = 2000; // 2 seconds

/**
 * Generates a unique three-word username in Title Case With Spaces
 * Ensures the username doesn't already exist in the database
 */
export const generateUniqueUsername = async (): Promise<string> => {
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const username = humanId({ separator: ' ', capitalize: true });

		const existingPlayer = await prisma.player.findUnique({
			where: { username }
		});

		if (!existingPlayer) {
			return username;
		}

		attempts++;
	}

	const baseUsername = humanId({ separator: ' ', capitalize: true });
	const timestamp = Date.now().toString().slice(-4);
	return `${baseUsername} ${timestamp}`;
};

export const findPlayerById = async (id: string): Promise<Player | null> => {
	const cached = playerCache.get(id);
	if (cached && cached.expires > Date.now()) {
		return cached.data;
	}

	const player = await prisma.player.findUnique({
		where: { id }
	});
	const domainPlayer = player ? toDomainPlayer(player) : null;

	playerCache.set(id, { data: domainPlayer, expires: Date.now() + CACHE_TTL });
	return domainPlayer;
};

export const findPlayerByIdWithFavorites = async (
	id: string,
	currentUserId?: string
): Promise<PlayerWithFavorites | null> => {
	// Note: We don't cache this aggressively as it contains user-specific favorite state
	// and aggregate counts that might change.
	const player = await prisma.player.findUnique({
		where: { id },
		include: {
			_count: {
				select: {
					favoritedBy: true
				}
			}
		}
	});

	if (!player) return null;

	let isFavoritedByCurrentUser = false;
	if (currentUserId) {
		const favoriteRelation = await prisma.playerFavorite.findUnique({
			where: {
				favoritingPlayerId_favoritedPlayerId: {
					favoritingPlayerId: currentUserId,
					favoritedPlayerId: id
				}
			}
		});
		isFavoritedByCurrentUser = !!favoriteRelation;
	}

	const domainPlayer = toDomainPlayer(player);
	return {
		...domainPlayer,
		favoriteCount: player._count.favoritedBy,
		isFavoritedByCurrentUser
	};
};

export const updatePlayer = async (id: string, data: Partial<Player>): Promise<Player> => {
	const player = await prisma.player.update({
		where: { id },
		data
	});
	logger.info(`Updated player ${id}`, { data });

	const domainPlayer = toDomainPlayer(player);
	playerCache.set(id, { data: domainPlayer, expires: Date.now() + CACHE_TTL });

	return domainPlayer;
};

export const getAdminPlayers = async (): Promise<Player[]> => {
	const admins = await prisma.player.findMany({
		where: { isAdmin: true }
	});
	return admins.map(toDomainPlayer);
};

export const isAdmin = async (userId: string): Promise<boolean> => {
	const player = await prisma.player.findUnique({
		where: { id: userId },
		select: { isAdmin: true }
	});
	return player?.isAdmin ?? false;
};

export const createPlayerFromClerk = async (userId: string): Promise<Player> => {
	const user = await clerkClient.users.getUser(userId);
	const generatedUsername = await generateUniqueUsername();

	const player = await prisma.player.create({
		data: {
			id: userId,
			username: generatedUsername,
			imageUrl: user.imageUrl!,
			isAdmin: user.emailAddresses.some((email) => email.emailAddress == ADMIN_EMAIL)
		}
	});
	logger.info(`Created player ${player.id} with username: ${generatedUsername}`);

	const admins = await getAdminPlayers();
	for (const admin of admins) {
		if (admin.id !== player.id) {
			// Avoid notifying an admin about their own creation
			await createNotification({
				userId: admin.id,
				type: 'admin_new_player',
				title: 'New Player Created',
				body: `A new player has been created: ${player.username}`,
				actionUrl: `/p/${player.id}`
			});
		}
	}

	const domainPlayer = toDomainPlayer(player);
	playerCache.set(userId, { data: domainPlayer, expires: Date.now() + CACHE_TTL });

	return domainPlayer;
};

export const fetchOrCreatePlayer = async (userId: string): Promise<Player> => {
	try {
		const player = await findPlayerById(userId);
		if (!player) {
			logger.info(`Player not found, creating new player from Clerk`, { userId });
			return await createPlayerFromClerk(userId);
		}
		return player;
	} catch (error: unknown) {
		// Enhanced error logging to help diagnose different failure types
		if (error && typeof error === 'object') {
			const e = error as {
				name?: string;
				code?: string;
				message?: string;
				meta?: { column?: string; modelName?: string };
			};
			const errorContext = {
				userId,
				errorName: e.name,
				errorCode: e.code,
				errorMessage: e.message,
				errorMeta: e.meta
			};

			if (e.code === 'P2022') {
				logger.error(
					'Database schema mismatch detected - column does not exist. Run `npx prisma migrate dev` to apply pending migrations.',
					{
						...errorContext,
						missingColumn: e.meta?.column,
						modelName: e.meta?.modelName,
						suggestion: 'Check if migrations are applied: npx prisma migrate status'
					}
				);
			} else if (e.code?.startsWith('P')) {
				logger.error('Prisma database error in fetchOrCreatePlayer', errorContext);
			} else if (e.message?.includes('clerk') || e.message?.includes('API')) {
				logger.error('Clerk API error in fetchOrCreatePlayer', errorContext);
			} else if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') {
				logger.error('Database connection error in fetchOrCreatePlayer', errorContext);
			} else {
				logger.error('Unknown error in fetchOrCreatePlayer', errorContext);
			}
		} else {
			logger.error('Unknown error in fetchOrCreatePlayer', { userId, error });
		}

		throw error;
	}
};

export const favoritePlayer = async (
	favoritingPlayerId: string,
	favoritedPlayerId: string,
	skipDuplicateCheck = false
): Promise<boolean> => {
	// Prevent self-favoriting
	if (favoritingPlayerId === favoritedPlayerId) {
		throw new Error('Cannot favorite yourself');
	}

	// Check if already favorited (unless skipping check for auto-favoriting)
	if (!skipDuplicateCheck) {
		const existing = await prisma.playerFavorite.findUnique({
			where: {
				favoritingPlayerId_favoritedPlayerId: {
					favoritingPlayerId,
					favoritedPlayerId
				}
			}
		});

		if (existing) {
			throw new Error('Player already favorited');
		}
	}

	// Use upsert to handle potential race conditions for auto-favoriting
	const result = await prisma.playerFavorite.upsert({
		where: {
			favoritingPlayerId_favoritedPlayerId: {
				favoritingPlayerId,
				favoritedPlayerId
			}
		},
		create: {
			favoritingPlayerId,
			favoritedPlayerId
		},
		update: {}
	});

	// PlayerFavorite doesn't have an updatedAt field, so check if we actually created a new record
	const isNew = !(await prisma.playerFavorite.findFirst({
		where: {
			favoritingPlayerId,
			favoritedPlayerId,
			createdAt: { lt: result.createdAt }
		}
	}));

	if (isNew) {
		logger.info(`Created favorite: ${favoritingPlayerId} -> ${favoritedPlayerId}`);
	}

	return isNew;
};

export const unfavoritePlayer = async (
	favoritingPlayerId: string,
	favoritedPlayerId: string
): Promise<void> => {
	const deleted = await prisma.playerFavorite.deleteMany({
		where: {
			favoritingPlayerId,
			favoritedPlayerId
		}
	});

	if (deleted.count === 0) {
		throw new Error('Favorite relationship not found');
	}

	logger.info(
		`Deleted favorite: ${favoritingPlayerId} -> ${favoritedPlayerId} (${deleted.count} records)`
	);
};

export const getFavoritedPlayers = async (playerId: string): Promise<Player[]> => {
	const favorites = await prisma.playerFavorite.findMany({
		where: {
			favoritingPlayerId: playerId
		},
		include: {
			favoritedPlayer: true
		},
		orderBy: {
			createdAt: 'desc'
		}
	});

	return favorites.map((favorite) => toDomainPlayer(favorite.favoritedPlayer));
};
