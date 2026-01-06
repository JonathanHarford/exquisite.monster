import { nudgePlayerLogic } from '$lib/server/remotes/nudge';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Nudge a player to take their turn
 */
export async function nudgePlayer(event: RequestEvent, gameId: string, playerId: string, turnId: string) {
	'use command';
	return nudgePlayerLogic(event, gameId, playerId, turnId);
}
