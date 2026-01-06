import { afterEach, vi } from 'vitest';

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
