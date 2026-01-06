import { beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import { execSync } from 'child_process';
import { DAYS, MINUTES, formatDuration } from '$lib/datetime';

const rawDatabaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_TEST;
const hasDatabaseUrl = Boolean(
	rawDatabaseUrl && rawDatabaseUrl !== 'undefined' && rawDatabaseUrl !== 'null' && rawDatabaseUrl.trim() !== ''
);

if (!hasDatabaseUrl) {
	throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set to run integration tests');
}

// Mock queue modules
vi.mock('$lib/server/queues/expirationQueue', () => ({
	scheduleTurnExpiration: vi.fn().mockResolvedValue(undefined),
	scheduleGameExpiration: vi.fn().mockResolvedValue(undefined),
	schedulePartyDeadline: vi.fn().mockResolvedValue(undefined),
	cancelTurnExpiration: vi.fn().mockResolvedValue(undefined),
	cancelGameExpiration: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/queues/emailQueue', () => ({
	queueFlagSubmittedEmail: vi.fn().mockResolvedValue(undefined),
	queueFlagConfirmedEmail: vi.fn().mockResolvedValue(undefined),
	queueFlagRejectedEmail: vi.fn().mockResolvedValue(undefined),
	queueGeneralNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/queues/storageCleanupQueue', () => ({
	scheduleTemporaryFileCleanup: vi.fn().mockResolvedValue(undefined),
	scheduleOrphanedFileCleanup: vi.fn().mockResolvedValue(undefined),
	scheduleRecurringCleanup: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('winston', () => ({
	default: {
		createLogger: vi.fn(() => ({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			log: vi.fn()
		})),
		format: { combine: vi.fn(), timestamp: vi.fn(), printf: vi.fn(), errors: vi.fn() },
		transports: { Console: vi.fn(), File: vi.fn() }
	}
}));

vi.mock('$lib/server/logger', () => ({
	logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() }
}));

// Mock Sentry to avoid $app dependency issues across all integration tests
vi.mock('@sentry/sveltekit', () => ({
	captureException: vi.fn(),
	init: vi.fn(),
	handleError: vi.fn(),
}));

// Mock SvelteKit server module
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn().mockReturnValue({
		tracing: {
			current: {
				setAttribute: vi.fn()
			}
		}
	})
}));

// Mock Clerk client and related modules
vi.mock('svelte-clerk/server', () => ({
	clerkClient: {
		users: {
			getUser: vi.fn().mockResolvedValue({
				id: 'test-user-id',
				imageUrl: 'https://example.com/avatar.jpg',
				emailAddresses: [{ emailAddress: 'test@example.com' }]
			}),
			deleteUser: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

vi.mock('@clerk/backend', () => ({
	createClerkClient: vi.fn().mockReturnValue({
		authenticateRequest: vi.fn().mockResolvedValue({
			isAuthenticated: true,
			toAuth: vi.fn().mockReturnValue({ userId: 'test-user-id' })
		})
	})
}));

const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

async function seedTestDatabase() {
	console.log('🧪 Seeding test database...');
	await prisma.gameConfig.upsert({
		where: { id: 'default' },
		update: {},
		create: {
			id: 'default',
			minTurns: 2,
			maxTurns: 4,
			writingTimeout: formatDuration(2 * MINUTES),
			drawingTimeout: formatDuration(5 * MINUTES),
			gameTimeout: formatDuration(1 * DAYS)
		}
	});
	const testPlayers = [
		{ id: 'test-player-1', username: 'p1p1', imageUrl: '/img/x/p1.png', isAdmin: false },
		{ id: 'test-player-2', username: 'p2p2', imageUrl: '/img/x/p2.png', isAdmin: false },
		{ id: 'test-player-3', username: 'p3p3', imageUrl: '/img/x/p3.png', isAdmin: false },
		{ id: 'test-player-4', username: 'p4p4', imageUrl: '/img/x/p4.png', isAdmin: false },
		{ id: 'admin', username: 'Jonathan', imageUrl: '/img/x/jonathan.png', isAdmin: true }
	];
	for (const player of testPlayers) {
		await prisma.player.upsert({ where: { id: player.id }, update: {}, create: player });
	}

	// Seed copytext templates for tests
	const { seedCopyText } = await import('../../prisma/seed/seedCopyText.js');
	await seedCopyText(prisma);

	console.log('✅ Test database seeded successfully');
}

async function cleanupTestData() {
	try {
		await prisma.$transaction(
			async (tx) => {
				await tx.turnFlag.deleteMany({});
				await tx.turn.deleteMany({});
				await tx.playersInSeasons.deleteMany({});
				await tx.game.deleteMany({});
				await tx.gameConfig.deleteMany({ where: { id: { not: 'default' } } });
				await tx.season.deleteMany({});
			},
			{ timeout: 5000 }
		);
	} catch {
		try {
			await prisma.turnFlag.deleteMany({});
			await prisma.turn.deleteMany({});
			await prisma.playersInSeasons.deleteMany({});
			await prisma.game.deleteMany({});
			await prisma.gameConfig.deleteMany({ where: { id: { not: 'default' } } });
			await prisma.season.deleteMany({});
		} catch (fallbackError) {
			console.error('🧪 Cleanup error:', fallbackError);
		}
	}
}

beforeAll(async () => {
	console.log('🧪 Setting up integration test environment...');
	console.log = (...args) => {
		if (args[0]?.includes?.('🧪') || args[0]?.includes?.('✅') || args[0]?.includes?.('❌')) {
			originalConsoleLog(...args);
		}
	};
	console.info = () => { };
	console.warn = () => { };
	console.error = () => { };

	console.log('🧪 Running migrations and seeding test database...');
	console.log(`🧪 Using DATABASE_URL: ${rawDatabaseUrl}`);
	try {
		console.log('🧪 Running migrations against test database...');

		// First try to reset the database to resolve any failed migrations
		try {
			execSync('npx prisma migrate reset --force --skip-seed', {
				stdio: 'pipe',
				env: { ...process.env }
			});
			console.log('✅ Database reset successful');
		} catch (_resetError) {
			console.log('🔄 Reset failed, trying deploy...');
			// If reset fails, try deploy (which might work if there are no failed migrations)
			execSync('npx prisma migrate deploy', {
				stdio: 'pipe',
				env: { ...process.env }
			});
		}
		console.log('✅ Migrations completed successfully');
	} catch (migrationError) {
		console.error('❌ Failed to run migrations:', migrationError);
		throw migrationError;
	}
	await prisma.$connect();
	console.log('🧪 Connected to test database');
	await seedTestDatabase();
}, 30000);

beforeEach(async () => {
	await cleanupTestData();
});

afterAll(async () => {
	console.log = originalConsoleLog;
	console.info = originalConsoleInfo;
	console.warn = originalConsoleWarn;
	console.error = originalConsoleError;

	await cleanupTestData();
	await prisma.$disconnect();
	console.log('🧪 Disconnected from test database');
});

afterEach(async () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});
