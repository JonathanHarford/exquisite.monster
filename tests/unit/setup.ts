import { afterEach, beforeEach, vi } from 'vitest';

// Suppress console output during tests (errors are expected in error-handling tests)
beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// Mock Redis - unit tests should not connect to Redis
vi.mock('ioredis', () => ({
	default: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		disconnect: vi.fn().mockResolvedValue(undefined),
		quit: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue('OK'),
		del: vi.fn().mockResolvedValue(1),
		exists: vi.fn().mockResolvedValue(0),
		expire: vi.fn().mockResolvedValue(1),
		ttl: vi.fn().mockResolvedValue(-1),
		flushall: vi.fn().mockResolvedValue('OK'),
		on: vi.fn(),
		off: vi.fn(),
		removeAllListeners: vi.fn()
	}))
}));

// Mock BullMQ - unit tests should not use queues
vi.mock('bullmq', () => ({
	Queue: vi.fn().mockImplementation(() => ({
		add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
		close: vi.fn().mockResolvedValue(undefined),
		on: vi.fn()
	})),
	Worker: vi.fn().mockImplementation(() => ({
		run: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		on: vi.fn()
	})),
	Job: vi.fn()
}));

// Mock queue modules
vi.mock('$lib/server/queues/expirationQueue', () => ({
	scheduleTurnExpiration: vi.fn().mockResolvedValue(undefined),
	scheduleGameExpiration: vi.fn().mockResolvedValue(undefined),
	turnExpirationQueue: null,
	gameExpirationQueue: null
}));

vi.mock('$lib/server/queues/emailQueue', () => ({
	queueFlagSubmittedEmail: vi.fn().mockResolvedValue(undefined),
	queueFlagConfirmedEmail: vi.fn().mockResolvedValue(undefined),
	queueFlagRejectedEmail: vi.fn().mockResolvedValue(undefined),
	queueGeneralNotification: vi.fn().mockResolvedValue(undefined),
	emailQueue: null
}));

vi.mock('$lib/server/redis', () => ({
	redis: {
		connect: vi.fn().mockResolvedValue(undefined),
		disconnect: vi.fn().mockResolvedValue(undefined),
		quit: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue('OK')
	}
}));

// Mock Winston logger
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

// Mock Clerk client
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

// Mock Sentry to prevent $app import errors
vi.mock('@sentry/sveltekit', () => ({
	init: vi.fn(),
	Sentry: {
		captureException: vi.fn(),
		captureMessage: vi.fn(),
		setUser: vi.fn(),
		setContext: vi.fn()
	},
	browserTracingIntegration: vi.fn(),
	replayIntegration: vi.fn(),
	handleErrorWithSentry: vi.fn((handler) => handler)
}));

afterEach(async () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});
