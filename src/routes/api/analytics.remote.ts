import * as analytics from '$lib/server/remotes/analytics';
import { query, getRequestEvent } from '$app/server';

/**
 * Get site overview analytics
 */
export const getSiteAnalytics = query(async () => {
	const event = getRequestEvent();
	return analytics.getSiteAnalyticsLogic(event);
});

/**
 * Get daily analytics for a specified number of days
 */
export const getDailyAnalytics = query('unchecked', async (days: number = 30) => {
	const event = getRequestEvent();
	return analytics.getDailyAnalyticsLogic(event, days);
});

/**
 * Get top players
 */
export const getTopPlayers = query(async () => {
	const event = getRequestEvent();
	return analytics.getTopPlayersLogic(event);
});

/**
 * Get game analytics
 */
export const getGameAnalytics = query(async () => {
	const event = getRequestEvent();
	return analytics.getGameAnalyticsLogic(event);
});

/**
 * Get trending games
 */
export const getTrendingGames = query(async () => {
	const event = getRequestEvent();
	return analytics.getTrendingGamesLogic(event);
});

/**
 * Get game details
 */
export const getGameDetails = query('unchecked', async (gameId: string) => {
	const event = getRequestEvent();
	return analytics.getGameDetailsLogic(event, gameId);
});

/**
 * Get flag analytics
 */
export const getFlagAnalytics = query(async () => {
	const event = getRequestEvent();
	return analytics.getFlagAnalyticsLogic(event);
});

/**
 * Get all analytics data
 */
export const getAllAnalytics = query('unchecked', async (days: number = 30) => {
	const event = getRequestEvent();
	return analytics.getAllAnalyticsLogic(event, days);
});
