import { prisma } from './prisma';

// Legacy transaction functions - deprecated, use setupTestData/cleanupTestData instead
export async function startTransaction() {
	console.warn('startTransaction is deprecated - use setupTestData instead');
	// No-op for backward compatibility during migration
}

export async function rollbackTransaction() {
	console.warn('rollbackTransaction is deprecated - use cleanupTestData instead');
	// No-op for backward compatibility during migration
}

export async function commitTransaction() {
	await prisma.$executeRawUnsafe('COMMIT;');
}

// New isolation strategy
export async function setupTestData(testName?: string) {
	// Fast cleanup instead of transactions
	await fastCleanupTestData();

	// Ensure essential test data exists
	await ensureTestDataExists();
}

export async function cleanupTestData() {
	// Targeted cleanup, preserving config data
	await fastCleanupTestData();
}

export async function ensureTestDataExists() {
	// Ensure test players exist (created by seed)
	const playerCount = await prisma.player.count();
	if (playerCount < 3) {
		throw new Error('Test requires at least 3 players (admin, p1, p2) - run db:seed');
	}

	// Ensure game config exists
	const configCount = await prisma.gameConfig.count();
	if (configCount === 0) {
		throw new Error('Test requires game config - run db:seed');
	}
}

export async function clearAllTables() {
	const tables = await prisma.$queryRaw<
		{ tablename: string }[]
	>`SELECT tablename FROM pg_tables WHERE schemaname = 'public';`;

	for (const { tablename } of tables) {
		if (tablename !== '_prisma_migrations') {
			try {
				await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`);
			} catch (error) {
				console.error(`Error truncating table ${tablename}:`, error);
			}
		}
	}
}

/**
 * Fast cleanup method that deletes test-specific data while preserving configuration.
 * This is safer than TRUNCATE as it preserves essential configuration data.
 */
export async function fastCleanupTestData() {
	// Delete in order to avoid foreign key constraints
	await prisma.turnFlag.deleteMany();
	// Preserve turns that belong to seeded games
	await prisma.turn.deleteMany({
		where: {
			gameId: { notIn: ['g_27N', 'g_27I', 'g_27J', 'g_27H', 'g_27L'] }
		}
	});
	// Preserve seeded games (start with 'g_') and config games
	await prisma.game.deleteMany({
		where: {
			AND: [
				{ id: { not: 'config-preserved-game' } },
				{ id: { notIn: ['g_27N', 'g_27I', 'g_27J', 'g_27H', 'g_27L'] } } // Preserve seeded games
			]
		}
	});
	await prisma.playerFavorite.deleteMany();
	await prisma.notification.deleteMany();
	await prisma.season.deleteMany();
	// Note: We preserve players, game config, copy text, seeded games and their turns as they're needed for tests
}

/**
 * Helper for test files to use transaction-based isolation.
 * Call this in beforeAll() and afterAll() hooks.
 */
export async function withTestTransaction(testFn: () => Promise<void>) {
	await startTransaction();
	try {
		await testFn();
	} finally {
		await rollbackTransaction();
	}
}
