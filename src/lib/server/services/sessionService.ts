import {
	fetchOrCreatePlayer
} from '$lib/server/services/playerService';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { getUnreadCount } from '$lib/server/services/notificationService';
import { getActiveGamesCount } from '$lib/server/services/gameService';
import { logger } from '$lib/server/logger';
import { redirect } from '@sveltejs/kit';
import { SECONDS } from '$lib/datetime';
import { loadTranslations } from '$lib/translations';
import type { Cookies } from '@sveltejs/kit';
import type { Player } from '$lib/types/domain';
import type { SessionData } from '$lib/types/session';

export class SessionService {
	/**
	 * Loads the session data required for the layout.
	 */
	static async loadSession({
		auth,
		url,
		cookies,
		request
	}: {
		auth: { userId?: string | null };
		url: URL;
		cookies: Cookies;
		request: Request;
	}): Promise<SessionData> {
		// Determine locale (hardcoded for now as in original code)
		const initialLocale = 'en';

		// Load translations
		try {
			await loadTranslations(initialLocale, url.pathname);
		} catch (error) {
			logger.error('Failed to load translations', { error });
		}

		let self: Player | null = null;
		if (auth?.userId) {
			try {
				self = await fetchOrCreatePlayer(auth.userId);
				logger.info('Successfully fetched player data', {
					userId: auth.userId,
					hasPlayer: !!self,
					playerUsername: self?.username
				});
			} catch (error) {
				logger.error('Failed to fetch or create player', {
					userId: auth?.userId,
					error
				});
				// Don't force logout on temporary fetch failures
			}
		} else {
			// Skip logging for known bots
			const userAgent = request.headers.get('user-agent') || '';
			const isBot =
				userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider');

			if (!isBot) {
				logger.warn('No auth.userId found in layout load', {
					hasAuth: !!auth,
					userId: auth?.userId,
					url: url.pathname
				});
			}
		}

		// Check if user is authenticated and profile is younger than 3 seconds (New Player Logic)
		if (self) {
			const profileAge = Date.now() - self.createdAt.getTime();
			const isNewPlayer = profileAge < 3 * SECONDS;

			// Only redirect if we're not already on the account page and user is new
			// (If there was an invitation redirect, it would have been handled before calling loadSession)
			if (isNewPlayer && !url.pathname.startsWith('/account')) {
				logger.info('New player detected, redirecting to account page', { playerId: self.id });
				throw redirect(302, '/account?e=newPlayer');
			}
		}

		// Fetch counts
		const unreadNotificationCount = self?.id ? await getUnreadCount(self.id) : 0;
		const activeGamesCount = await getActiveGamesCount();

		// Pending games/turns logic
		const pendingData = await this.getPendingData(self);

		return {
			self,
			unreadNotificationCount,
			activeGamesCount,
			...pendingData
		};
	}

	private static async getPendingData(self: Player | null) {
		let pendingGame = undefined;
		let pendingTurn = undefined;
		let previousTurn = undefined;
		let pendingPartyTurnCount = 0;

		if (self?.id) {
			try {
				// Get all pending games for the player
				const pendingGames = await GameUseCases.findAllPendingGamesByPlayerId(self.id);

				// Count all pending party turns
				pendingPartyTurnCount = pendingGames
					.filter((game) => game.seasonId) // Party games have seasonId
					.reduce(
						(count, game) =>
							count +
							game.turns.filter((turn) => turn.playerId === self.id && turn.status === 'pending')
								.length,
						0
					);

				// Find most urgent turn: on-demand first, then stalest party turn
				const onDemandGame = pendingGames.find((game) => !game.seasonId);

				if (onDemandGame) {
					// Prioritize on-demand turns
					pendingGame = onDemandGame;
					pendingTurn = onDemandGame.turns.find(
						(turn) => turn.playerId === self.id && turn.status === 'pending'
					);
				} else {
					// Find stalest party turn
					const partyGamesWithTurns = pendingGames
						.filter((game) => game.seasonId)
						.map((game) => ({
							game,
							pendingTurn: game.turns.find(
								(turn) => turn.playerId === self.id && turn.status === 'pending'
							)
						}))
						.filter(({ pendingTurn }) => pendingTurn)
						.sort(
							(a, b) =>
								new Date(a.pendingTurn!.createdAt).getTime() -
								new Date(b.pendingTurn!.createdAt).getTime()
						);

					if (partyGamesWithTurns.length > 0) {
						const stalest = partyGamesWithTurns[0];
						pendingGame = stalest.game;
						pendingTurn = stalest.pendingTurn;
					}
				}

				// NOTE: We REMOVED the side-effect of deleting expired turns here.
				// This should be handled by a background job or lazily when accessing the turn.
				// However, we should check expiration to not return expired turns.

				if (
					pendingTurn &&
					pendingTurn.expiresAt &&
					new Date(pendingTurn.expiresAt) < new Date()
				) {
					// It's expired, so don't show it as pending
					pendingTurn = undefined;
					pendingGame = undefined;
				}

				// Find the most recently completed turn in the pending game
				if (pendingGame) {
					previousTurn = pendingGame.turns
						.filter((turn) => turn.completedAt)
						.sort(
							(a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
						)[0];
				}
			} catch (error) {
				logger.error('Failed to find pending games', { playerId: self.id, error });
			}
		}

		return {
			pendingGame,
			pendingTurn,
			previousTurn,
			pendingPartyTurnCount
		};
	}
}
