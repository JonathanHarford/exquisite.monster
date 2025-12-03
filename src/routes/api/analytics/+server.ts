import { json } from '@sveltejs/kit';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, locals }) => {
	// Check if user is authenticated and is admin
	const player = locals.auth()?.userId
		? await prisma.player.findUnique({
				where: { id: locals.auth().userId },
				select: { isAdmin: true }
			})
		: null;

	if (!player?.isAdmin) {
		return json({ error: 'Forbidden - Admin access required' }, { status: 403 });
	}

	try {
		const type = url.searchParams.get('type') || 'overview';
		const days = parseInt(url.searchParams.get('days') || '30');

		switch (type) {
			case 'overview': {
				const siteAnalytics = await AdminUseCases.getSiteAnalytics();
				return json(siteAnalytics);
			}

			case 'daily': {
				const dailyAnalytics = await AdminUseCases.getDailyAnalytics(days);
				return json(dailyAnalytics);
			}

			case 'players': {
				const topPlayers = await AdminUseCases.getTopPlayers();
				return json(topPlayers);
			}

			case 'games': {
				const gameAnalytics = await AdminUseCases.getGameAnalytics();
				return json(gameAnalytics);
			}

			case 'trending': {
				const trendingGames = await AdminUseCases.getTrendingGames();
				return json(trendingGames);
			}

			case 'game-details': {
				const gameId = url.searchParams.get('gameId');
				if (!gameId) {
					return json({ error: 'Game ID is required for game details' }, { status: 400 });
				}
				const gameDetails = await AdminUseCases.getGameDetails(gameId);
				if (!gameDetails) {
					return json({ error: 'Game not found' }, { status: 404 });
				}
				return json(gameDetails);
			}

			case 'flags': {
				const flagAnalytics = await AdminUseCases.getFlagAnalytics();
				return json(flagAnalytics);
			}

			case 'all': {
				// Get all analytics data in one request
				const [site, daily, players, games, flags] = await Promise.all([
					AdminUseCases.getSiteAnalytics(),
					AdminUseCases.getDailyAnalytics(days),
					AdminUseCases.getTopPlayers(),
					AdminUseCases.getGameAnalytics(),
					AdminUseCases.getFlagAnalytics()
				]);

				return json({
					site,
					daily,
					players,
					games,
					flags,
					generatedAt: new Date().toISOString()
				});
			}

			default:
				return json({ error: 'Invalid analytics type' }, { status: 400 });
		}
	} catch (error) {
		console.error('Analytics API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
