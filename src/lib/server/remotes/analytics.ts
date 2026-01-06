import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { prisma } from '$lib/server/prisma';
import type { RequestEvent } from '@sveltejs/kit';

async function checkAdmin(userId: string | null) {
	if (!userId) return false;
	const player = await prisma.player.findUnique({
		where: { id: userId },
		select: { isAdmin: true }
	});
	return !!player?.isAdmin;
}

export async function getSiteAnalyticsLogic(event: RequestEvent) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}
	return await AdminUseCases.getSiteAnalytics();
}

export async function getDailyAnalyticsLogic(event: RequestEvent, days: number = 30) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}
	return await AdminUseCases.getDailyAnalytics(days);
}

export async function getTopPlayersLogic(event: RequestEvent) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}
	return await AdminUseCases.getTopPlayers();
}

export async function getGameAnalyticsLogic(event: RequestEvent) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}
	return await AdminUseCases.getGameAnalytics();
}

export async function getTrendingGamesLogic(event: RequestEvent) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}
	return await AdminUseCases.getTrendingGames();
}

export async function getGameDetailsLogic(event: RequestEvent, gameId: string) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}

	if (!gameId) {
		throw new Error('Game ID is required for game details');
	}
	const gameDetails = await AdminUseCases.getGameDetails(gameId);
	if (!gameDetails) {
		throw new Error('Game not found');
	}
	return gameDetails;
}

export async function getFlagAnalyticsLogic(event: RequestEvent) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}
	return await AdminUseCases.getFlagAnalytics();
}

export async function getAllAnalyticsLogic(event: RequestEvent, days: number = 30) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}

	const [site, daily, players, games, flags] = await Promise.all([
		AdminUseCases.getSiteAnalytics(),
		AdminUseCases.getDailyAnalytics(days),
		AdminUseCases.getTopPlayers(),
		AdminUseCases.getGameAnalytics(),
		AdminUseCases.getFlagAnalytics()
	]);

	return {
		site,
		daily,
		players,
		games,
		flags,
		generatedAt: new Date().toISOString()
	};
}
