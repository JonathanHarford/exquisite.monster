import {
	extractInvitationParam,
	getInvitationData
} from '$lib/utils/invitation';
import { logger } from '$lib/server/logger';
import { redirect, type Cookies } from '@sveltejs/kit';
import {
	fetchOrCreatePlayer,
	favoritePlayer,
	findPlayerById
} from '$lib/server/services/playerService';
import { createNotification } from '$lib/server/services/notificationService';
import type { Player } from '$lib/types/domain';

export class InvitationService {
	/**
	 * Checks for invitation parameter in URL and sets a cookie if found.
	 * Redirects to clean URL if invitation param was present.
	 */
	static handleInvitationParam(url: URL, cookies: Cookies): void {
		const invitationParam = extractInvitationParam(url);
		if (invitationParam) {
			logger.info('Invitation parameter found in URL', { invitationParam });
			const invitationData = getInvitationData(invitationParam);
			if (invitationData) {
				// Store invitation in cookie and clean URL
				cookies.set('invitation', invitationParam, {
					maxAge: 60 * 60 * 24, // 24 hours
					path: '/',
					httpOnly: false // Client needs to clear it if needed
				});

				// Clean the URL by redirecting without the invitation parameter
				const cleanUrl = new URL(url);
				cleanUrl.searchParams.delete('i');
				throw redirect(302, cleanUrl.toString());
			}
		}
	}

	/**
	 * Processes any stored invitation in the cookies.
	 * Returns inviter info (for display) and/or a redirect URL (if invitation was accepted).
	 */
	static async processStoredInvitation(
		cookies: Cookies,
		auth: { userId?: string | null }
	): Promise<{ inviterInfo: Player | null; redirectUrl: string }> {
		const storedInvitation = cookies.get('invitation');
		let inviterInfo: Player | null = null;
		let redirectUrl = '';

		if (!storedInvitation) {
			return { inviterInfo, redirectUrl };
		}

		logger.info('Invitation found in cookie', { storedInvitation });
		const invitationData = getInvitationData(storedInvitation);

		if (invitationData) {
			logger.info('Invitation data found', { invitationData });

			try {
				// Get inviter info for alert display
				const inviter = await findPlayerById(invitationData.inviterId);
				if (!inviter) {
					logger.error('Inviter not found', { invitationData });
					throw new Error('Inviter not found');
				}

				// Set inviter info for the invitation alert
				inviterInfo = inviter;

				// Only process invitation if user is authenticated
				if (auth.userId && invitationData.inviterId !== auth.userId) {
					// Ensure the new user exists in the database before creating favorite
					await fetchOrCreatePlayer(auth.userId);

					// Auto-favorite the inviter
					const wasNewFavorite = await favoritePlayer(auth.userId, invitationData.inviterId, true);

					if (wasNewFavorite) {
						// Create notification for the inviter
						const user = await findPlayerById(auth.userId);

						if (user) {
							await createNotification({
								userId: invitationData.inviterId,
								type: 'invitation_accepted',
								templateData: {
									inviteeUsername: user.username,
									inviteeId: auth.userId
								},
								actionUrl: `/p/${auth.userId}`
							});
						}

						logger.info(
							`Invitation accepted: ${auth.userId} favorited ${invitationData.inviterId}`,
							{
								inviteeId: auth.userId,
								inviterId: invitationData.inviterId,
								wasNewFavorite
							}
						);
					}

					// Clear the invitation cookie
					cookies.delete('invitation', { path: '/' });

					// Set up redirect
					redirectUrl = `/p/${invitationData.inviterId}`;
				}
			} catch (error) {
				logger.error('Failed to process invitation', error, {
					userId: auth.userId,
					inviterId: invitationData.inviterId
				});
				// Clear the problematic invitation cookie
				cookies.delete('invitation', { path: '/' });
			}
		}
		return { inviterInfo, redirectUrl };
	}
}
