import { prisma } from '$lib/server/prisma';
import type { GameWithTurns, Comment } from '$lib/types/domain';
import { toDomainGameWithTurns, toDomainComment } from '$lib/types/domain';
import { logger } from '$lib/server/logger';

export const adminGameInclude = {
	turns: { include: { player: true, flags: true } },
	config: true,
	season: true,
	_count: {
		select: {
			favoritedBy: true
		}
	}
};

export const gameInclude = {
	// Same as adminGameInclude, but no rejected turns
	...adminGameInclude,
	turns: { include: { player: true, flags: true }, where: { rejectedAt: null } }
};

export const turnInclude = {
	flags: true
};

export const getPlayerGameHistory = async (
	playerId: string,
	options: {
		limit?: number;
		offset?: number;
		statusFilter?: 'completed' | 'active' | 'all';
	} = {}
): Promise<{ games: GameWithTurns[]; total: number }> => {
	const { limit = 10, offset = 0, statusFilter = 'all' } = options;

	const baseWhereClause = {
		turns: {
			some: {
				playerId: playerId,
				rejectedAt: null
			}
		},
		deletedAt: null
	};

	const whereClause =
		statusFilter === 'completed'
			? { ...baseWhereClause, completedAt: { not: null } }
			: statusFilter === 'active'
				? { ...baseWhereClause, completedAt: null, expiresAt: { gt: new Date() } }
				: baseWhereClause;

	// Add party game visibility condition
	const finalWhereClause = {
		AND: [whereClause, { OR: [{ seasonId: null }, { season: { status: 'completed' } }] }]
	};

	const total = await prisma.game.count({
		where: finalWhereClause
	});

	const games = await prisma.game.findMany({
		where: finalWhereClause,
		include: {
			config: true,
			turns: {
				include: {
					player: true
				},
				where: {
					rejectedAt: null
				},
				orderBy: {
					orderIndex: 'asc'
				}
			},
			_count: {
				select: {
					favoritedBy: true
				}
			}
		},
		orderBy: {
			createdAt: 'desc'
		},
		take: limit,
		skip: offset
	});

	const transformedGames: GameWithTurns[] = games.map((game) => {
		return toDomainGameWithTurns(game);
	});

	return { games: transformedGames, total };
};

export const getCompletedGames = async (
	options: {
		limit?: number;
	} = {}
): Promise<GameWithTurns[]> => {
	const { limit = 50 } = options;

	const games = await prisma.game.findMany({
		where: {
			completedAt: { not: null },
			deletedAt: null,
			config: {
				isLewd: false
			}
		},
		include: {
			config: true,
			turns: {
				include: {
					player: true
				},
				where: {
					rejectedAt: null
				},
				orderBy: {
					orderIndex: 'asc'
				}
			},
			_count: {
				select: {
					favoritedBy: true
				}
			}
		},
		orderBy: {
			completedAt: 'desc'
		},
		take: limit
	});

	logger.info(`Found ${games.length} completed games`);
	const transformedGames: GameWithTurns[] = games.map((game) => {
		return toDomainGameWithTurns(game);
	});

	return transformedGames;
};

export const getGameById = async (gameId: string): Promise<GameWithTurns | null> => {
	const game = await prisma.game.findUnique({
		where: { id: gameId },
		include: {
			config: true,
			turns: {
				include: {
					player: true,
					flags: true
				},
				where: {
					rejectedAt: null
				},
				orderBy: {
					orderIndex: 'asc'
				}
			},
			_count: {
				select: {
					favoritedBy: true
				}
			}
		}
	});

	if (!game) return null;

	return toDomainGameWithTurns(game);
};

export const getActiveGamesCount = async (): Promise<number> => {
	return await prisma.game.count({
		where: {
			deletedAt: null,
			completedAt: null
		}
	});
};

export const createComment = async (
	gameId: string,
	playerId: string,
	text: string
): Promise<Comment> => {
	const newComment = await prisma.comment.create({
		data: {
			gameId,
			playerId,
			text
		},
		include: {
			player: true
		}
	});
	logger.info(`Created comment ${newComment.id} on game ${gameId} by player ${playerId}`);
	return toDomainComment(newComment);
};

export const getCommentsByGameId = async (gameId: string): Promise<Comment[]> => {
	const comments = await prisma.comment.findMany({
		where: { gameId },
		include: {
			player: true
		},
		orderBy: {
			createdAt: 'asc'
		}
	});
	return comments.map((comment) => toDomainComment(comment));
};

/**
 * Visibility Logic:
 * - When viewing own profile: Show ALL games (completed + incomplete)
 * - When viewing others' profile: Show ALL completed games + shared incomplete games
 */
export const getVisiblePlayerGameHistory = async (
	profilePlayerId: string,
	viewingPlayerId: string | null,
	options: {
		limit?: number;
		offset?: number;
		statusFilter?: 'completed' | 'incomplete' | 'all';
	} = {}
): Promise<{ games: GameWithTurns[]; total: number }> => {
	const { limit = 10, offset = 0, statusFilter = 'all' } = options;

	// If no viewing player, return empty results for security
	if (!viewingPlayerId) {
		return { games: [], total: 0 };
	}

	// If viewing own profile, use the original function with different status mapping
	if (profilePlayerId === viewingPlayerId) {
		const mappedStatus = statusFilter === 'incomplete' ? 'active' : statusFilter;
		return getPlayerGameHistory(profilePlayerId, { limit, offset, statusFilter: mappedStatus });
	}

	// For viewing others' profiles: Show ALL completed games + shared incomplete games
	const baseWhereClause = {
		turns: {
			some: {
				playerId: profilePlayerId,
				rejectedAt: null
			}
		},
		deletedAt: null
	};

	let whereClause;

	if (statusFilter === 'completed') {
		// Show ALL completed games by the profile player (no sharing requirement)
		whereClause = {
			...baseWhereClause,
			completedAt: { not: null }
		};
	} else if (statusFilter === 'incomplete') {
		// Show only shared incomplete games
		whereClause = {
			...baseWhereClause,
			completedAt: null,
			expiresAt: { gt: new Date() },
			// Must also have viewing player participation for incomplete games
			AND: [
				{
					turns: {
						some: {
							playerId: viewingPlayerId,
							rejectedAt: null
						}
					}
				}
			]
		};
	} else {
		whereClause = {
			...baseWhereClause,
			OR: [
				{
					completedAt: { not: null }
				},
				{
					completedAt: null,
					expiresAt: { gt: new Date() },
					AND: [
						{
							turns: {
								some: {
									playerId: viewingPlayerId,
									rejectedAt: null
								}
							}
						}
					]
				}
			]
		};
	}

	// Add party game visibility condition
	const finalWhereClause = {
		AND: [whereClause, { OR: [{ seasonId: null }, { season: { status: 'completed' } }] }]
	};

	const total = await prisma.game.count({
		where: finalWhereClause
	});

	const games = await prisma.game.findMany({
		where: finalWhereClause,
		include: {
			config: true,
			turns: {
				include: {
					player: true
				},
				where: {
					rejectedAt: null
				},
				orderBy: {
					orderIndex: 'asc'
				}
			},
			_count: {
				select: {
					favoritedBy: true
				}
			}
		},
		orderBy: {
			createdAt: 'desc'
		},
		take: limit,
		skip: offset
	});

	const transformedGames: GameWithTurns[] = games.map((game) => {
		return toDomainGameWithTurns(game);
	});

	return { games: transformedGames, total };
};

export const findAllImagePaths = async (): Promise<string[]> => {
	try {
		const turns = await prisma.turn.findMany({
			where: {
				isDrawing: true,
				rejectedAt: null
			},
			select: { content: true }
		});

		const players = await prisma.player.findMany({
			select: { imageUrl: true }
		});

		const imagePaths: string[] = [];

		for (const turn of turns) {
			if (turn.content && typeof turn.content === "string") {
				imagePaths.push(turn.content);
			}
		}

		for (const player of players) {
			if (player.imageUrl) {
				imagePaths.push(player.imageUrl);
			}
		}

		logger.debug(`Found ${imagePaths.length} image paths referenced in database`);
		return imagePaths;
	} catch (error) {
		logger.error("Failed to find image paths:", error);
		return [];
	}
};
