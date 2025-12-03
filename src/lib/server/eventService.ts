import { prisma } from '$lib/server/prisma';

export interface AdminEvent {
	timestamp: Date;
	type: string;
	description: string;
	link?: string;
}

const MAX_EVENTS = 50; // Default limit if not specified

export async function getRecentEvents(limit: number = MAX_EVENTS): Promise<AdminEvent[]> {
	const events: AdminEvent[] = [];

	// Player Created
	const newPlayers = await prisma.player.findMany({
		orderBy: { createdAt: 'desc' },
		take: limit,
		select: { id: true, username: true, createdAt: true }
	});
	newPlayers.forEach((p) =>
		events.push({
			timestamp: p.createdAt,
			type: 'Player Created',
			description: `Player ${p.username} created.`,
			link: `/p/${p.id}`
		})
	);

	// Player Banned
	const bannedPlayers = await prisma.player.findMany({
		where: { bannedAt: { not: null } },
		orderBy: { bannedAt: 'desc' },
		take: limit,
		select: { id: true, username: true, bannedAt: true }
	});
	bannedPlayers.forEach((p) =>
		events.push({
			timestamp: p.bannedAt!,
			type: 'Player Banned',
			description: `Player ${p.username} banned.`,
			link: `/p/${p.id}`
		})
	);

	// Game Created
	const newGames = await prisma.game.findMany({
		orderBy: { createdAt: 'desc' },
		take: limit,
		select: { id: true, createdAt: true }
	});
	newGames.forEach((g) =>
		events.push({
			timestamp: g.createdAt,
			type: 'Game Created',
			description: `Game ${g.id} created.`,
			link: `/g/${g.id}`
		})
	);

	// Game Completed
	const completedGames = await prisma.game.findMany({
		where: { completedAt: { not: null } },
		orderBy: { completedAt: 'desc' },
		take: limit,
		select: { id: true, completedAt: true }
	});
	completedGames.forEach((g) =>
		events.push({
			timestamp: g.completedAt!,
			type: 'Game Completed',
			description: `Game ${g.id} completed.`,
			link: `/g/${g.id}`
		})
	);

	// Turn Submitted (use completedAt for "submitted and processed")
	const submittedTurns = await prisma.turn.findMany({
		where: { completedAt: { not: null } }, // Assuming a turn is "submitted" when it's completed by a player
		orderBy: { completedAt: 'desc' },
		take: limit,
		select: {
			id: true,
			gameId: true,
			playerId: true,
			completedAt: true,
			player: { select: { username: true } }
		}
	});
	submittedTurns.forEach((t) =>
		events.push({
			timestamp: t.completedAt!,
			type: 'Turn Submitted',
			description: `Turn by ${t.player.username} in game ${t.gameId}.`,
			link: `/g/${t.gameId}` // Link to game, not specific turn for now
		})
	);

	// Turn Flagged
	const flaggedTurns = await prisma.turnFlag.findMany({
		orderBy: { createdAt: 'desc' },
		take: limit,
		select: {
			id: true,
			turnId: true,
			createdAt: true,
			reason: true,
			turn: { select: { gameId: true, player: { select: { username: true } } } }
		}
	});
	flaggedTurns.forEach((f) =>
		events.push({
			timestamp: f.createdAt,
			type: 'Turn Flagged',
			description: `Turn by ${f.turn.player.username} in game ${f.turn.gameId} flagged for: ${f.reason}.`,
			link: `/g/${f.turn.gameId}` // Potentially link to a specific flag management page if it exists
		})
	);

	// Game Flagged (derived from TurnFlag)
	// This is more complex as a game is flagged if one of its turns is.
	// For simplicity in this event stream, we'll rely on individual "Turn Flagged" events.
	// A dedicated "Flagged Games" list might be better than individual events here.

	// Sort all collected events by timestamp and take the most recent ones
	return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
}

export async function getDashboardMetrics() {
	const now = new Date();
	const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)); // For "new" metrics

	// Player counts
	const totalPlayers = await prisma.player.count();
	const newPlayersLast30Days = await prisma.player.count({
		where: { createdAt: { gte: thirtyDaysAgo } }
	});
	const bannedPlayers = await prisma.player.count({
		where: { bannedAt: { not: null } }
	});

	// Game counts
	const totalGames = await prisma.game.count({ where: { deletedAt: null } });
	const newGamesLast30Days = await prisma.game.count({
		where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null }
	});
	const completedGames = await prisma.game.count({
		where: { completedAt: { not: null }, deletedAt: null }
	});

	// Turns
	const totalTurns = await prisma.turn.count();
	const completedTurns = await prisma.turn.count({
		// "Passed" turns
		where: { completedAt: { not: null }, rejectedAt: null }
	});

	// Flags
	// Turn Flags
	const totalTurnFlags = await prisma.turnFlag.count();
	const resolvedTurnFlags = await prisma.turnFlag.count({ where: { resolvedAt: { not: null } } });
	const pendingTurnFlags = totalTurnFlags - resolvedTurnFlags;

	// "Flagged Games" count: Games with at least one unresolved turn flag
	// This query is a bit more involved.
	const flaggedGamesWithUnresolvedFlags = await prisma.game.count({
		where: {
			deletedAt: null,
			turns: {
				some: {
					flags: {
						some: {
							resolvedAt: null
						}
					}
				}
			}
		}
	});

	return {
		players: {
			total: totalPlayers,
			newLast30Days: newPlayersLast30Days,
			banned: bannedPlayers
		},
		games: {
			total: totalGames,
			newLast30Days: newGamesLast30Days,
			completed: completedGames,
			flagged: flaggedGamesWithUnresolvedFlags // Games with active flags
		},
		turns: {
			submitted: totalTurns, // Total turns created
			passed: completedTurns, // Turns completed and not rejected
			flagged: pendingTurnFlags // Active, unresolved turn flags
		}
	};
}
