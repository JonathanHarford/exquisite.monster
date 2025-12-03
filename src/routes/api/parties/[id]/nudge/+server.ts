import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { nudgePlayer } from '$lib/server/services/nudgeService';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	try {
		const auth = locals.auth();
		if (!auth?.userId) {
			throw error(401, 'Unauthorized');
		}

		const partyId = params.id;
		const { turnId, gameId, playerId } = await request.json();

		if (!turnId || !gameId || !playerId) {
			throw error(400, 'Missing required fields: turnId, gameId, playerId');
		}

		// Send the nudge
		const result = await nudgePlayer(auth.userId, playerId, turnId, gameId);

		if (!result.success) {
			if (result.cooldownRemainingHours) {
				throw error(
					429,
					`Nudge is on cooldown. Try again in ${result.cooldownRemainingHours} hours.`
				);
			}
			throw error(400, result.message);
		}

		logger.info(
			`Nudge sent in party ${partyId} from ${auth.userId} to ${playerId} for turn ${turnId}`
		);

		return json({
			success: true,
			message: result.message
		});
	} catch (err) {
		logger.error('Failed to process nudge request', err);

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to send nudge');
	}
};
