import { nudgePlayer as nudgePlayerService } from '$lib/server/services/nudgeService';
import { logger } from '$lib/server/logger';
import type { RequestEvent } from '@sveltejs/kit';

export async function nudgePlayerLogic(event: RequestEvent, gameId: string, playerId: string, turnId: string) {
	const auth = event.locals.auth();
	if (!auth?.userId) {
		throw new Error('Unauthorized');
	}

	if (!turnId || !gameId || !playerId) {
		throw new Error('Missing required fields: turnId, gameId, playerId');
	}

	try {
		// Send the nudge
		const result = await nudgePlayerService(auth.userId, playerId, turnId, gameId);

		if (!result.success) {
			if (result.cooldownRemainingHours) {
				throw new Error(`Nudge is on cooldown. Try again in ${result.cooldownRemainingHours} hours.`);
			}
			throw new Error(result.message);
		}

		logger.info(
			`Nudge sent from ${auth.userId} to ${playerId} for turn ${turnId} in game ${gameId}`
		);

		return {
			success: true,
			message: result.message
		};
	} catch (err) {
		logger.error('Failed to process nudge request', err);
		throw err;
	}
}
