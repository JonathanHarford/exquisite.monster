import { prisma } from '$lib/server/prisma';
import type { TurnFlag } from '$lib/types/domain';
import { toDomainTurnFlag } from '$lib/types/domain';
import { logger } from '../logger';

export const createTurnFlag = async (
	turnId: string,
	playerId: string,
	reason: 'spam' | 'offensive' | 'other',
	explanation?: string
): Promise<TurnFlag> => {
	const flag = await prisma.turnFlag.create({
		data: {
			turnId,
			playerId,
			reason,
			explanation
		}
	});
	logger.info(`Created turn flag ${flag.id} on turn ${turnId} by player ${playerId} (${reason})`);
	return toDomainTurnFlag(flag);
};
