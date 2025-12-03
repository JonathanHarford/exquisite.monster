import { prisma } from '$lib/server/prisma';
import { fetchGameConfig } from '$lib/server/services/configService';
import { type GameConfig, toDomainPlayer, type Player } from '$lib/types/domain';

export const getPlayers = async (users: Player[], expected?: number): Promise<Player[]> => {
	const players = users
		.filter((p) => p.username.match(/p\dp\d/))
		.sort((a, b) => a.username.localeCompare(b.username))
		.map((p) => toDomainPlayer(p));
	if (expected && players.length != expected) {
		throw new Error('Setup failed: Expected ' + expected + ' players, got ' + players.length);
	}
	return players;
};

export const getAdmin = async (users: Player[]): Promise<Player> => {
	const admin = users.find((p) => p.isAdmin);
	if (!admin) {
		throw new Error('Setup failed: Admin user not found');
	}
	return toDomainPlayer(admin);
};

export const replaceDefaultConfig = async (newConfig: GameConfig) => {
	const oldConfig = await fetchGameConfig('default');
	await prisma.gameConfig.upsert({
		where: { id: 'default' },
		update: { ...newConfig },
		create: {
			id: 'default',
			// Default values are provided if not present in oldConfig or newConfig
			minTurns: (newConfig.minTurns ?? oldConfig.minTurns) ?? 2,
			maxTurns: (newConfig.maxTurns ?? oldConfig.maxTurns) ?? 4,
			writingTimeout: (newConfig.writingTimeout ?? oldConfig.writingTimeout) ?? '2m',
			drawingTimeout: (newConfig.drawingTimeout ?? oldConfig.drawingTimeout) ?? '5m',
			gameTimeout: (newConfig.gameTimeout ?? oldConfig.gameTimeout) ?? '1d',
			isLewd: (newConfig.isLewd ?? oldConfig.isLewd) ?? false
		}
	});
	return oldConfig;
};

export const deleteAllGames = async () => {
	const deletedGames = await prisma.game.deleteMany({
		where: { id: { notIn: ['default'] } }
	});
	console.log(`🧪 Deleted ${deletedGames.count} games`);
};
