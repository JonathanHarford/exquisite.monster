import { prisma } from '$lib/server/prisma';
import { clerkClient } from 'svelte-clerk/server';
import { logger } from '$lib/server/logger';

export class AdminUseCases {
	static async getGameList() {
		const prismaGames = await prisma.game.findMany({
			orderBy: {
				updatedAt: 'desc'
			},
			include: {
				_count: {
					select: {
						turns: true
					}
				},
				config: true,
				turns: {
					orderBy: {
						orderIndex: 'desc'
					},
					include: {
						player: true,
						flags: true
					}
				}
			}
		});

		const gamesWithFlagInfo = prismaGames.map((prismaGame) => {
			const completedTurn = prismaGame.turns.find((turn) => turn.completedAt);
			const pendingTurn = prismaGame.turns.find((turn) => turn.completedAt === null);
			const hasFlaggedTurns = prismaGame.turns.some((turn) =>
				turn.flags.some((flag) => flag.resolvedAt === null)
			);

			const completedTurnsCount = prismaGame.turns.filter((turn) => turn.completedAt).length;

			return {
				...prismaGame,
				completedTurn,
				pendingTurn,
				hasFlaggedTurns,
				completedTurnsCount
			};
		});

		return gamesWithFlagInfo.sort((a, b) => {
			if (a.hasFlaggedTurns && !b.hasFlaggedTurns) return -1;
			if (!a.hasFlaggedTurns && b.hasFlaggedTurns) return 1;

			if (a.deletedAt && !b.deletedAt) return 1;
			if (!a.deletedAt && b.deletedAt) return -1;

			const aIsActive = !a.completedAt && !a.deletedAt;
			const bIsActive = !b.completedAt && !b.deletedAt;

			if (aIsActive && !bIsActive) return -1;
			if (!aIsActive && bIsActive) return 1;

			return b.updatedAt.getTime() - a.updatedAt.getTime();
		});
	}

	static async getPlayerList() {
		const players = await prisma.player.findMany({
			include: {
				_count: {
					select: {
						turns: true,
						turnFlags: true
					}
				}
			}
		});

		try {
			const clerkUsers = await clerkClient.users.getUserList({
				limit: 500,
				orderBy: '-last_active_at'
			});

			const clerkUserMap = new Map(
				clerkUsers.data.map((user) => [
					user.id,
					{
						lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt) : null,
						updatedAt: user.updatedAt ? new Date(user.updatedAt) : null
					}
				])
			);

			const playersWithActivity = players.map((player) => {
				const clerkData = clerkUserMap.get(player.id);
				return {
					...player,
					lastActiveAt: clerkData?.lastActiveAt || player.createdAt,
					clerkUpdatedAt: clerkData?.updatedAt || player.updatedAt
				};
			});

			return playersWithActivity.sort((a, b) => {
				const dateComparison = b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
				if (dateComparison !== 0) return dateComparison;
				return a.username.localeCompare(b.username);
			});
		} catch (error) {
			logger.error('Failed to fetch user activity from Clerk:', error);

			return players
				.map((player) => ({
					...player,
					lastActiveAt: player.updatedAt
				}))
				.sort((a, b) => {
					const dateComparison = b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
					if (dateComparison !== 0) return dateComparison;
					return a.username.localeCompare(b.username);
				});
		}
	}

	static async getSiteAnalytics() {
		const now = new Date();
		const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const [
			totalPlayers,
			totalGames,
			totalTurns,
			totalFlags,
			activePlayers7d,
			activePlayers30d,
			newPlayers7d,
			newPlayers30d,
			newGames7d,
			newGames30d,
			completedGames,
			activeGames,
			resolvedFlags,
			pendingFlags
		] = await Promise.all([
			prisma.player.count({ where: { bannedAt: null } }),
			prisma.game.count({ where: { deletedAt: null } }),
			prisma.turn.count({ where: { rejectedAt: null } }),
			prisma.turnFlag.count(),

			prisma.player.count({
				where: {
					bannedAt: null,
					turns: {
						some: {
							completedAt: { gte: last7Days }
						}
					}
				}
			}),
			prisma.player.count({
				where: {
					bannedAt: null,
					turns: {
						some: {
							completedAt: { gte: last30Days }
						}
					}
				}
			}),

			prisma.player.count({
				where: {
					bannedAt: null,
					createdAt: { gte: last7Days }
				}
			}),
			prisma.player.count({
				where: {
					bannedAt: null,
					createdAt: { gte: last30Days }
				}
			}),

			prisma.game.count({
				where: {
					deletedAt: null,
					createdAt: { gte: last7Days }
				}
			}),
			prisma.game.count({
				where: {
					deletedAt: null,
					createdAt: { gte: last30Days }
				}
			}),

			prisma.game.count({
				where: {
					deletedAt: null,
					completedAt: { not: null }
				}
			}),
			prisma.game.count({
				where: {
					deletedAt: null,
					completedAt: null
				}
			}),

			prisma.turnFlag.count({
				where: {
					resolvedAt: { not: null }
				}
			}),
			prisma.turnFlag.count({
				where: {
					resolvedAt: null
				}
			})
		]);

		return {
			overview: {
				totalPlayers,
				totalGames,
				totalTurns,
				totalFlags,
				completedGames,
				activeGames,
				resolvedFlags,
				pendingFlags
			},
			activity: {
				activePlayers7d,
				activePlayers30d,
				newPlayers7d,
				newPlayers30d,
				newGames7d,
				newGames30d
			}
		};
	}

	static async getDailyAnalytics(days: number = 30) {
		const endDate = new Date();
		const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

		const groupByDate = (
			items: Array<{ createdAt?: Date | null; completedAt?: Date | null }>,
			dateField: 'createdAt' | 'completedAt' = 'createdAt'
		) => {
			const grouped = new Map<string, number>();

			items.forEach((item) => {
				const date = item[dateField];
				if (date) {
					const dateKey = date.toISOString().split('T')[0];
					grouped.set(dateKey, (grouped.get(dateKey) || 0) + 1);
				}
			});

			return Array.from(grouped.entries())
				.map(([date, count]) => ({ date, count }))
				.sort((a, b) => a.date.localeCompare(b.date));
		};

		const players = await prisma.player.findMany({
			where: {
				createdAt: { gte: startDate, lte: endDate },
				bannedAt: null
			},
			select: { createdAt: true }
		});

		const games = await prisma.game.findMany({
			where: {
				createdAt: { gte: startDate, lte: endDate },
				deletedAt: null
			},
			select: { createdAt: true }
		});

		const turns = await prisma.turn.findMany({
			where: {
				completedAt: { gte: startDate, lte: endDate },
				rejectedAt: null
			},
			select: { completedAt: true }
		});

		const flags = await prisma.turnFlag.findMany({
			where: {
				createdAt: { gte: startDate, lte: endDate }
			},
			select: { createdAt: true }
		});

		return {
			players: groupByDate(players),
			games: groupByDate(games),
			turns: groupByDate(turns, 'completedAt'),
			flags: groupByDate(flags)
		};
	}

	static async getTopPlayers() {
		const topByTurns = await prisma.player.findMany({
			where: { bannedAt: null },
			include: {
				_count: {
					select: {
						turns: true,
						turnFlags: true
					}
				}
			},
			orderBy: {
				turns: {
					_count: 'desc'
				}
			},
			take: 10
		});

		const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const mostActive = await prisma.player.findMany({
			where: {
				bannedAt: null,
				turns: {
					some: {
						completedAt: { gte: last30Days }
					}
				}
			},
			include: {
				_count: {
					select: {
						turns: {
							where: {
								completedAt: { gte: last30Days }
							}
						}
					}
				}
			},
			orderBy: {
				turns: {
					_count: 'desc'
				}
			},
			take: 10
		});

		return {
			topByTurns,
			mostActive
		};
	}

	static async getGameAnalytics() {
		const completedGames = await prisma.game.findMany({
			where: {
				deletedAt: null,
				completedAt: { not: null }
			},
			select: {
				createdAt: true,
				completedAt: true,
				_count: {
					select: {
						turns: true
					}
				}
			}
		});

		const gameStats = completedGames.reduce(
			(acc, game) => {
				if (game.completedAt) {
					const duration = game.completedAt.getTime() - game.createdAt.getTime();
					acc.totalDuration += duration;
					acc.totalTurns += game._count.turns;
					acc.count++;
				}
				return acc;
			},
			{ totalDuration: 0, totalTurns: 0, count: 0 }
		);

		const avgCompletionTimeHours =
			gameStats.count > 0 ? gameStats.totalDuration / gameStats.count / (1000 * 60 * 60) : 0;
		const avgTurnsPerGame = gameStats.count > 0 ? gameStats.totalTurns / gameStats.count : 0;

		const [activeGames, completedGamesCount, gamesWithFlags] = await Promise.all([
			prisma.game.count({
				where: {
					deletedAt: null,
					completedAt: null
				}
			}),
			prisma.game.count({
				where: {
					deletedAt: null,
					completedAt: { not: null }
				}
			}),
			prisma.game.count({
				where: {
					deletedAt: null,
					turns: {
						some: {
							flags: {
								some: {}
							}
						}
					}
				}
			})
		]);

		return {
			overview: {
				activeGames,
				completedGames: completedGamesCount,
				gamesWithFlags,
				avgCompletionTimeHours: Math.round(avgCompletionTimeHours * 100) / 100,
				avgTurnsPerGame: Math.round(avgTurnsPerGame * 100) / 100
			}
		};
	}

	static async getFlagAnalytics() {
		const [totalFlags, resolvedFlags, pendingFlags, flagsByReason] = await Promise.all([
			prisma.turnFlag.count(),
			prisma.turnFlag.count({ where: { resolvedAt: { not: null } } }),
			prisma.turnFlag.count({ where: { resolvedAt: null } }),
			prisma.turnFlag.groupBy({
				by: ['reason'],
				_count: {
					reason: true
				},
				orderBy: {
					_count: {
						reason: 'desc'
					}
				}
			})
		]);

		const resolutionRate = totalFlags > 0 ? (resolvedFlags / totalFlags) * 100 : 0;

		return {
			overview: {
				totalFlags,
				resolvedFlags,
				pendingFlags,
				resolutionRate: Math.round(resolutionRate * 100) / 100
			},
			byReason: flagsByReason.map((item) => ({
				reason: item.reason,
				count: item._count.reason
			}))
		};
	}

	static async getPlayerDetails(playerId: string) {
		const player = await prisma.player.findUnique({
			where: { id: playerId },
			include: {
				_count: {
					select: {
						turns: true,
						turnFlags: true,
						favoritedBy: true,
						favorites: true
					}
				},
				turns: {
					include: {
						game: {
							select: {
								id: true,
								completedAt: true,
								createdAt: true
							}
						},
						flags: {
							include: {
								player: {
									select: {
										id: true,
										username: true
									}
								}
							}
						}
					},
					orderBy: {
						completedAt: 'desc'
					},
					take: 10
				},
				turnFlags: {
					include: {
						turn: {
							include: {
								player: {
									select: {
										id: true,
										username: true
									}
								},
								game: {
									select: {
										id: true
									}
								}
							}
						}
					},
					orderBy: {
						createdAt: 'desc'
					},
					take: 10
				}
			}
		});

		if (!player) {
			return null;
		}

		const now = new Date();
		const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const playerWithTurns = player as typeof player & {
			turns: Array<{
				completedAt: Date | null;
				game: { id: string; completedAt: Date | null; createdAt: Date };
				flags: Array<{ player: { id: string; username: string } }>;
			}>;
		};

		const recentTurns7d = playerWithTurns.turns.filter(
			(turn) => turn.completedAt && turn.completedAt >= last7Days
		).length;

		const recentTurns30d = playerWithTurns.turns.filter(
			(turn) => turn.completedAt && turn.completedAt >= last30Days
		).length;

		const gamesParticipated = await prisma.game.count({
			where: {
				turns: {
					some: {
						playerId: playerId,
						completedAt: { not: null }
					}
				}
			}
		});

		const completedGames = await prisma.game.count({
			where: {
				completedAt: { not: null },
				turns: {
					some: {
						playerId: playerId,
						completedAt: { not: null }
					}
				}
			}
		});

		const lastTurn = playerWithTurns.turns.find((turn) => turn.completedAt);
		const lastActivity = lastTurn?.completedAt || player.createdAt;

		return {
			...player,
			activity: {
				recentTurns7d,
				recentTurns30d,
				gamesParticipated,
				completedGames,
				lastActivity
			}
		};
	}

	static async deletePlayer(playerId: string) {
		const player = await prisma.player.findUnique({
			where: { id: playerId },
			select: {
				id: true,
				username: true,
				isAdmin: true
			}
		});

		if (!player) {
			throw new Error('Player not found');
		}

		if (player.isAdmin) {
			throw new Error('Cannot delete admin users');
		}

		try {
			await clerkClient.users.deleteUser(playerId);
			logger.info(`Deleted Clerk user: ${playerId} (${player.username})`);
		} catch (clerkError) {
			logger.error(`Failed to delete Clerk user ${playerId}:`, clerkError);
		}

		try {
			await prisma.player.delete({
				where: { id: playerId }
			});
			logger.info(`Deleted player from database: ${playerId} (${player.username})`);
		} catch (dbError) {
			logger.error(`Failed to delete player from database ${playerId}:`, dbError);
			throw new Error('Failed to delete player from database');
		}

		return { success: true, username: player.username };
	}

	static async getGameDetails(gameId: string) {
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			include: {
				_count: {
					select: {
						turns: true
					}
				},
				turns: {
					include: {
						player: {
							select: {
								id: true,
								username: true,
								imageUrl: true
							}
						},
						flags: {
							include: {
								player: {
									select: {
										id: true,
										username: true
									}
								}
							}
						}
					},
					orderBy: {
						orderIndex: 'asc'
					}
				},
				config: true
			}
		});

		if (!game) {
			return null;
		}

		const completedTurns = game.turns.filter((turn) => turn.completedAt);
		const flaggedTurns = game.turns.filter((turn) => turn.flags.length > 0);
		const uniquePlayers = new Set(game.turns.map((turn) => turn.playerId)).size;

		const completionRate =
			game.turns.length > 0 ? (completedTurns.length / game.turns.length) * 100 : 0;

		let avgTurnCompletionTime = 0;
		if (completedTurns.length > 1) {
			const completionTimes = completedTurns.slice(1).map((turn, index) => {
				const prevTurn = completedTurns[index];
				return turn.completedAt!.getTime() - prevTurn.completedAt!.getTime();
			});
			avgTurnCompletionTime =
				completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length;
		}

		let gameDuration = 0;
		if (game.completedAt) {
			gameDuration = game.completedAt.getTime() - game.createdAt.getTime();
		} else if (completedTurns.length > 0) {
			const lastCompletedTurn = completedTurns[completedTurns.length - 1];
			gameDuration = lastCompletedTurn.completedAt!.getTime() - game.createdAt.getTime();
		}

		const playerStats = game.turns.reduce(
			(acc, turn) => {
				if (!acc[turn.playerId]) {
					acc[turn.playerId] = {
						player: turn.player,
						turnCount: 0,
						completedTurns: 0,
						flaggedTurns: 0,
						drawingTurnCount: 0,
						writingTurnCount: 0
					};
				}
				acc[turn.playerId].turnCount++;
				if (turn.completedAt) acc[turn.playerId].completedTurns++;
				if (turn.flags.length > 0) acc[turn.playerId].flaggedTurns++;
				if (turn.isDrawing) acc[turn.playerId].drawingTurnCount++;
				else acc[turn.playerId].writingTurnCount++;
				return acc;
			},
			{} as Record<
				string,
				{
					player: { id: string; username: string; imageUrl: string };
					turnCount: number;
					completedTurns: number;
					flaggedTurns: number;
					drawingTurnCount: number;
					writingTurnCount: number;
				}
			>
		);

		return {
			...game,
			analytics: {
				uniquePlayers,
				completedTurns: completedTurns.length,
				flaggedTurns: flaggedTurns.length,
				completionRate: Math.round(completionRate * 100) / 100,
				avgTurnCompletionTimeHours:
					Math.round((avgTurnCompletionTime / (1000 * 60 * 60)) * 100) / 100,
				gameDurationHours: Math.round((gameDuration / (1000 * 60 * 60)) * 100) / 100,
				playerStats: Object.values(playerStats)
			}
		};
	}

	static async getTrendingGames() {
		const now = new Date();
		const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const mostActiveGames = await prisma.game.findMany({
			where: {
				deletedAt: null,
				turns: {
					some: {
						completedAt: { gte: last7Days }
					}
				}
			},
			include: {
				_count: {
					select: {
						turns: true
					}
				},
				turns: {
					where: {
						completedAt: { gte: last7Days }
					},
					select: {
						id: true,
						completedAt: true
					}
				}
			},
			orderBy: {
				updatedAt: 'desc'
			},
			take: 10
		});

		const gamesWithPlayerCounts = await prisma.game.findMany({
			where: {
				deletedAt: null,
				turns: {
					some: {
						rejectedAt: null
					}
				}
			},
			include: {
				_count: {
					select: {
						turns: {
							where: {
								rejectedAt: null
							}
						}
					}
				},
				turns: {
					where: {
						rejectedAt: null
					},
					select: {
						playerId: true
					},
					distinct: ['playerId']
				}
			},
			take: 50
		});

		const gamesWithMostPlayers = gamesWithPlayerCounts
			.map((game) => ({
				id: game.id,
				createdAt: game.createdAt,
				completedAt: game.completedAt,
				uniquePlayers: game.turns.length,
				totalTurns: game._count.turns
			}))
			.sort((a, b) => {
				if (b.uniquePlayers !== a.uniquePlayers) {
					return b.uniquePlayers - a.uniquePlayers;
				}
				return b.totalTurns - a.totalTurns;
			})
			.slice(0, 10);

		const recentlyCompletedGames = await prisma.game.findMany({
			where: {
				deletedAt: null,
				completedAt: { not: null, gte: last30Days }
			},
			include: {
				_count: {
					select: {
						turns: true
					}
				}
			},
			orderBy: {
				completedAt: 'desc'
			},
			take: 10
		});

		const gamesWithMostTurns = await prisma.game.findMany({
			where: {
				deletedAt: null
			},
			include: {
				_count: {
					select: {
						turns: true
					}
				}
			},
			orderBy: {
				turns: {
					_count: 'desc'
				}
			},
			take: 10
		});

		return {
			mostActive: mostActiveGames.map((game) => ({
				...game,
				recentTurns: game.turns.length
			})),
			mostPlayers: gamesWithMostPlayers,
			recentlyCompleted: recentlyCompletedGames,
			mostTurns: gamesWithMostTurns
		};
	}

	static async getGameListWithAnalytics() {
		const games = await this.getGameList();

		const gamesWithAnalytics = await Promise.all(
			games.map(async (game) => {
				const uniquePlayers = await prisma.turn.groupBy({
					by: ['playerId'],
					where: {
						gameId: game.id,
						rejectedAt: null
					}
				});

				const completedTurns = game.turns.filter((turn) => turn.completedAt);
				const completionRate =
					game.turns.length > 0 ? (completedTurns.length / game.turns.length) * 100 : 0;

				let gameDurationHours = 0;
				if (game.completedAt) {
					gameDurationHours =
						(game.completedAt.getTime() - game.createdAt.getTime()) / (1000 * 60 * 60);
				}

				return {
					...game,
					analytics: {
						uniquePlayers: uniquePlayers.length,
						completionRate: Math.round(completionRate * 100) / 100,
						gameDurationHours: Math.round(gameDurationHours * 100) / 100
					}
				};
			})
		);

		return gamesWithAnalytics;
	}
	static async getPartyList() {
		const parties = await prisma.season.findMany({
			include: {
				creator: true,
				players: {
					where: {
						joinedAt: { not: null }
					}
				},
				games: {
					select: {
						completedAt: true
					}
				}
			}
		});

		const processedParties = parties.map((party) => {
			const totalGames = party.games.length;
			const completedGames = party.games.filter((g) => g.completedAt).length;
			const completionPercentage = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;

			return {
				...party,
				playerCount: party.players.length,
				completionPercentage
			};
		});

		const statusOrder: Record<string, number> = {
			active: 1,
			open: 2,
			completed: 3,
			closed: 4
		};

		return processedParties.sort((a, b) => {
			const orderA = statusOrder[a.status] || 99;
			const orderB = statusOrder[b.status] || 99;

			if (orderA !== orderB) {
				return orderA - orderB;
			}
			return b.createdAt.getTime() - a.createdAt.getTime();
		});
	}

	static async toggleGameLewdStatus(gameId: string): Promise<void> {
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			include: { config: true }
		});

		if (!game) {
			throw new Error('Game not found');
		}

		await prisma.gameConfig.update({
			where: { id: game.configId },
			data: { isLewd: !game.config.isLewd }
		});

		logger.info(`Game ${gameId} lewd status toggled to ${!game.config.isLewd}`);
	}

	static async setGamePoster(gameId: string, turnId: string): Promise<void> {
		const game = await prisma.game.findUnique({
			where: { id: gameId }
		});

		if (!game) {
			throw new Error('Game not found');
		}

		const turn = await prisma.turn.findUnique({
			where: { id: turnId }
		});

		if (!turn) {
			throw new Error('Turn not found');
		}

		if (turn.gameId !== gameId) {
			throw new Error('Turn does not belong to this game');
		}

		await prisma.game.update({
			where: { id: gameId },
			data: { posterTurnId: turnId }
		});

		logger.info(`Game ${gameId} poster set to turn ${turnId}`);
	}
}
