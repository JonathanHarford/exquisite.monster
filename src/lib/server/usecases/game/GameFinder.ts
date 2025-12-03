import { prisma } from '$lib/server/prisma';
import type { GameWithTurns, Turn } from '$lib/types/domain';
import { toDomainGameWithTurns, toDomainTurn } from '$lib/types/domain';
import { gameInclude, turnInclude, adminGameInclude } from '../../services/gameService';

export class GameFinder {
	static async findGameById(id: string): Promise<GameWithTurns | null> {
		const game = await prisma.game.findUnique({
			where: { id, deletedAt: null },
			include: gameInclude
		});

		if (!game) return null;

		if (game.season && game.season.status !== 'completed') {
			return null;
		}

		if (game.turns.some((turn) => turn.flags?.some((flag) => !flag.resolvedAt))) {
			return null;
		}
		const gameWithTurns = toDomainGameWithTurns(game);
		gameWithTurns.turns = gameWithTurns.turns.filter((turn) => !turn.rejectedAt);
		gameWithTurns.turns.sort((a, b) => a.orderIndex - b.orderIndex);
		return gameWithTurns;
	}

	static async findGameByIdAdmin(id: string): Promise<GameWithTurns | null> {
		const game = await prisma.game.findUnique({
			where: { id },
			include: adminGameInclude
		});
		if (!game) return null;

		const gameWithTurns = toDomainGameWithTurns(game);
		gameWithTurns.turns.sort((a, b) => a.orderIndex - b.orderIndex);
		return gameWithTurns;
	}

	static async findGameByTurnId(turnId: string): Promise<GameWithTurns | null> {
		const turn = await prisma.turn.findUnique({
			where: { id: turnId, game: { deletedAt: null } },
			include: {
				game: { include: gameInclude }
			}
		});

		if (!turn?.game) return null;

		if (turn.game.turns.some((turn) => turn.flags?.some((flag) => !flag.resolvedAt))) {
			return null;
		}

		const gameWithTurns = toDomainGameWithTurns(turn.game);
		gameWithTurns.turns = gameWithTurns.turns.filter((turn) => !turn.rejectedAt);
		return gameWithTurns;
	}

	static async findGameByTurnIdAdmin(turnId: string): Promise<GameWithTurns | null> {
		const turn = await prisma.turn.findUnique({
			where: { id: turnId, game: { deletedAt: null } },
			include: {
				game: { include: adminGameInclude }
			}
		});

		if (!turn?.game) return null;

		return toDomainGameWithTurns(turn.game);
	}

	static async findTurnById(id: string): Promise<Turn | null> {
		const turn = await prisma.turn.findUnique({
			where: { id, game: { deletedAt: null } },
			include: turnInclude
		});
		return turn ? toDomainTurn(turn) : null;
	}

	static async findPendingGameByPlayerId(playerId: string): Promise<GameWithTurns | null> {
		const game = await prisma.game.findFirst({
			where: {
				completedAt: null,
				deletedAt: null,
				turns: {
					some: {
						playerId,
						completedAt: null
					}
				}
			},
			include: gameInclude
		});
		return game ? toDomainGameWithTurns(game) : null;
	}

	static async findAllPendingTurnsByPlayerId(playerId: string): Promise<Turn[]> {
		const turns = await prisma.turn.findMany({
			where: {
				playerId,
				completedAt: null,
				rejectedAt: null,
				game: {
					completedAt: null,
					deletedAt: null
				}
			},
			include: turnInclude,
			orderBy: {
				createdAt: 'asc' // Oldest first (stalest turn)
			}
		});
		return turns.map(toDomainTurn);
	}

	static async findAllPendingPartyTurnsByPlayerId(playerId: string): Promise<Turn[]> {
		const turns = await prisma.turn.findMany({
			where: {
				playerId,
				completedAt: null,
				rejectedAt: null,
				game: {
					completedAt: null,
					deletedAt: null,
					seasonId: { not: null } // Only party games
				}
			},
			include: turnInclude,
			orderBy: {
				createdAt: 'asc' // Oldest first (stalest turn)
			}
		});
		return turns.map(toDomainTurn);
	}

	static async findAllPendingGamesByPlayerId(playerId: string): Promise<GameWithTurns[]> {
		const games = await prisma.game.findMany({
			where: {
				completedAt: null,
				deletedAt: null,
				turns: {
					some: {
						playerId,
						completedAt: null,
						rejectedAt: null
					}
				}
			},
			include: gameInclude,
			orderBy: {
				createdAt: 'asc' // Oldest first (stalest game)
			}
		});
		return games.map(toDomainGameWithTurns);
	}

	static async checkAvailableGameTypes(playerId: string): Promise<{
		writingSafe: boolean;
		writingLewd: boolean;
		drawingSafe: boolean;
		drawingLewd: boolean;
	}> {
		const candidateGames = await prisma.game.findMany({
			where: {
				completedAt: null,
				deletedAt: null,
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
			include: gameInclude
		});

		const result = {
			writingSafe: false,
			writingLewd: false,
			drawingSafe: false,
			drawingLewd: false
		};

		for (const candidate of candidateGames) {
			const completedTurnsCount = candidate.turns.filter(
				(turn) => turn.completedAt !== null && turn.rejectedAt === null
			).length;

			if (candidate.config.maxTurns && completedTurnsCount >= candidate.config.maxTurns) {
				continue;
			}

			const nextTurnIsDrawing = completedTurnsCount % 2 === 1;
			const isLewd = candidate.config.isLewd;

			if (nextTurnIsDrawing) {
				if (isLewd) {
					result.drawingLewd = true;
				} else {
					result.drawingSafe = true;
				}
			} else {
				if (isLewd) {
					result.writingLewd = true;
				} else {
					result.writingSafe = true;
				}
			}
		}

		return result;
	}

	static async getGamesForGallery(params: {
		filter: 'best-7' | 'best-30' | 'best-all' | 'latest';
		page: number;
		limit: number;
		userId?: string;
		showLewd?: boolean;
	}): Promise<{
		games: GameWithTurns[];
		hasMore: boolean;
		total: number;
	}> {
		const { filter, page, limit } = params;
		const offset = (page - 1) * limit;

		const baseWhere = {
			deletedAt: null,
			completedAt: { not: null },
			...(params.showLewd === false && { config: { isLewd: false } }),
			turns: {
				none: {
					flags: {
						some: {
							resolvedAt: null
						}
					}
				}
			}
		};

		let dateFilter = {};
		if (filter === 'best-7') {
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
			dateFilter = { completedAt: { gte: sevenDaysAgo } };
		} else if (filter === 'best-30') {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			dateFilter = { completedAt: { gte: thirtyDaysAgo } };
		}

		const whereClause = { ...baseWhere, ...dateFilter };

		let orderBy;
		if (filter === 'latest') {
			orderBy = [{ completedAt: 'desc' as const }, { favoritedBy: { _count: 'desc' as const } }];
		} else {
			orderBy = [{ favoritedBy: { _count: 'desc' as const } }, { completedAt: 'desc' as const }];
		}

		const total = await prisma.game.count({ where: whereClause });

		const games = await prisma.game.findMany({
			where: whereClause,
			orderBy,
			skip: offset,
			take: limit,
			include: {
				turns: {
					where: { rejectedAt: null },
					include: { player: true, flags: true },
					orderBy: { orderIndex: 'asc' }
				},
				config: true,
				_count: {
					select: {
						favoritedBy: true
					}
				}
			}
		});

		const domainGames = games.map((game) => toDomainGameWithTurns(game));
		const hasMore = offset + games.length < total;

		return {
			games: domainGames,
			hasMore,
			total
		};
	}
}
