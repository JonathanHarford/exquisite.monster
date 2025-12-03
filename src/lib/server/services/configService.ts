import { prisma } from '$lib/server/prisma';
import type { GameConfig } from '$lib/types/domain';

export const fetchGameConfig = async (gameId: string): Promise<GameConfig> => {
	const config = await prisma.gameConfig.findUnique({ where: { id: gameId } });
	if (!config) {
		throw new Error(`Config not found: ${gameId}`);
	}
	// return strictly the domain object fields
	return {
		minTurns: config.minTurns,
		maxTurns: config.maxTurns,
		writingTimeout: config.writingTimeout,
		drawingTimeout: config.drawingTimeout,
		gameTimeout: config.gameTimeout,
		isLewd: config.isLewd
	};
};

export const fetchDefaultGameConfig = async (): Promise<GameConfig> => {
	return await fetchGameConfig('default');
};
