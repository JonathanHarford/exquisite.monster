import { QueueManager, createQueueOptions, createWorkerOptions } from './config.js';
import { GameUseCases } from '$lib/server/usecases/GameUseCases.js';
import type { Game, Turn } from '$lib/types/domain.js';
import { logger } from '$lib/server/logger.js';
import { queueMonitor } from './monitor.js';
import type { Job } from 'bullmq';

// Turn expiration worker processor

interface TurnExpirationJobData {
	id: string;
	// We don't strictly need expiresAt, orderIndex, gameId for the deleteTurnIfExpired call
	// as it fetches the turn, but including them for clarity or potential direct use.
	expiresAt: Date | null;
	orderIndex: number;
	gameId: string;
}

const processTurnExpiration = async (job: Job): Promise<void> => {
	const turnData: TurnExpirationJobData = job.data;
	await GameUseCases.deleteTurnIfExpired(turnData.id);
};

// Game expiration worker processor
const processGameExpiration = async (job: Job): Promise<void> => {
	const game: Game = job.data;
	logger.info(`Processing expiration for game ${game.id}`);
	await GameUseCases.completeGameIfExpired(game.id);
};

// Party deadline worker processor
interface PartyDeadlineJobData {
	partyId: string;
	deadline: Date;
}

const processPartyDeadline = async (job: Job): Promise<void> => {
	const partyData: PartyDeadlineJobData = job.data;
	logger.info(`Processing party deadline for party ${partyData.partyId}`);

	try {
		// Import PartyUseCases dynamically to avoid circular dependency
		const { PartyUseCases } = await import('../usecases/PartyUseCases.js');
		await PartyUseCases.checkPartyActivation(partyData.partyId);
	} catch (error) {
		logger.error(`Failed to process party deadline for ${partyData.partyId}`, error);
		throw error; // Re-throw to allow queue retry mechanism
	}
};

// Create queue managers with custom options
const turnExpirationQueueManager = new QueueManager(
	'turn-expiration',
	createQueueOptions({
		defaultJobOptions: {
			removeOnComplete: 0,
			removeOnFail: 0,
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 1000
			}
		}
	}),
	createWorkerOptions({
		concurrency: 5,
		limiter: {
			max: 100,
			duration: 1000
		}
	}),
	processTurnExpiration
);

const gameExpirationQueueManager = new QueueManager(
	'game-expiration',
	createQueueOptions({
		defaultJobOptions: {
			removeOnComplete: 0,
			removeOnFail: 0,
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 1000
			}
		}
	}),
	createWorkerOptions({
		concurrency: 5,
		limiter: {
			max: 100,
			duration: 1000
		}
	}),
	processGameExpiration
);

const partyDeadlineQueueManager = new QueueManager(
	'party-deadline',
	createQueueOptions({
		defaultJobOptions: {
			removeOnComplete: 10,
			removeOnFail: 10,
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 2000
			}
		}
	}),
	createWorkerOptions({
		concurrency: 3,
		limiter: {
			max: 50,
			duration: 1000
		}
	}),
	processPartyDeadline
);

// Export initialization function to be called at app startup
export const initializeExpirationQueues = async (): Promise<void> => {
	await Promise.all([
		turnExpirationQueueManager.initialize(),
		gameExpirationQueueManager.initialize(),
		partyDeadlineQueueManager.initialize()
	]);

	// Register with monitoring system
	if (turnExpirationQueueManager.isReady) {
		queueMonitor.registerQueue('turn-expiration', turnExpirationQueueManager);
	}
	if (gameExpirationQueueManager.isReady) {
		queueMonitor.registerQueue('game-expiration', gameExpirationQueueManager);
	}
	if (partyDeadlineQueueManager.isReady) {
		queueMonitor.registerQueue('party-deadline', partyDeadlineQueueManager);
	}
};

export const scheduleTurnExpiration = async (turn: Turn): Promise<void> => {
	if (!turn.expiresAt) {
		logger.warn(`Cannot schedule expiration for turn ${turn.id} - no expiration date`);
		return;
	}

	const delay = Math.max(0, turn.expiresAt.getTime() - Date.now());

	const jobData: TurnExpirationJobData = {
		id: turn.id,
		expiresAt: turn.expiresAt,
		orderIndex: turn.orderIndex,
		gameId: turn.gameId
	};

	try {
		await turnExpirationQueueManager.addJob(`turn-${turn.id}`, jobData, {
			delay,
			jobId: `turn-${turn.id}`,
			priority: 1
		});
		logger.debug(`Scheduled turn expiration for ${turn.id} in ${delay}ms`);
	} catch (error) {
		logger.error(`Failed to schedule turn expiration for ${turn.id}:`, error);
		// Don't throw - let the game creation continue, but log the failure
		// The performExpirations method will handle this as a fallback
	}
};

export const scheduleGameExpiration = async (game: Game): Promise<void> => {
	if (!game.expiresAt) {
		logger.warn(`Cannot schedule expiration for game ${game.id} - no expiration date`);
		return;
	}

	const delay = Math.max(0, game.expiresAt.getTime() - Date.now());

	try {
		await gameExpirationQueueManager.addJob(`game-${game.id}`, game, {
			delay,
			jobId: `game-${game.id}`,
			priority: 2 // Lower priority than turns
		});
		logger.debug(`Scheduled game expiration for ${game.id} in ${delay}ms`);
	} catch (error) {
		logger.error(`Failed to schedule game expiration for ${game.id}:`, error);
		// Don't throw - let the game creation continue, but log the failure
		// The performExpirations method will handle this as a fallback
	}
};

export const schedulePartyDeadline = async (partyId: string, deadline: Date): Promise<void> => {
	// Skip queue operations in test environments
	if (
		process.env.NODE_ENV === 'test' ||
		process.env.PUBLIC_ENVIRONMENT === 'test' ||
		process.env.PLAYWRIGHT_TEST === 'true'
	) {
		logger.debug('Skipping party deadline queue operation in test environment');
		return;
	}

	const now = Date.now();
	const delay = Math.max(0, deadline.getTime() - now);

	if (delay <= 0) {
		logger.warn(`Cannot schedule party deadline for ${partyId} - deadline is in the past`);
		return;
	}

	try {
		const jobData: PartyDeadlineJobData = {
			partyId,
			deadline
		};

		// Add timeout to prevent hanging in environments without Redis
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('Queue operation timeout')), 1000); // 1 second timeout
		});

		await Promise.race([
			partyDeadlineQueueManager.addJob(`party-${partyId}`, jobData, {
				delay,
				jobId: `party-${partyId}`,
				priority: 3 // Lower priority than turns and games
			}),
			timeoutPromise
		]);
		logger.debug(`Scheduled party deadline for ${partyId} in ${delay}ms`);
	} catch (error) {
		logger.error(`Failed to schedule party deadline for ${partyId}:`, error);
		// Don't throw - let the party creation continue, but log the failure
	}
};

/**
 * Cancel a scheduled turn expiration job
 */
export const cancelTurnExpiration = async (turnId: string): Promise<void> => {
	// Skip queue operations in test environments
	if (
		process.env.NODE_ENV === 'test' ||
		process.env.PUBLIC_ENVIRONMENT === 'test' ||
		process.env.PLAYWRIGHT_TEST === 'true'
	) {
		return;
	}

	try {
		const jobId = `turn-${turnId}`;
		const job = await turnExpirationQueueManager.queueInstance?.getJob(jobId);
		if (job) {
			await job.remove();
			logger.debug(`Cancelled turn expiration job for ${turnId}`);
		}
	} catch (error) {
		logger.error(`Failed to cancel turn expiration for ${turnId}:`, error);
		// Don't throw - this is a cleanup operation
	}
};

/**
 * Cancel a scheduled game expiration job
 */
export const cancelGameExpiration = async (gameId: string): Promise<void> => {
	// Skip queue operations in test environments
	if (
		process.env.NODE_ENV === 'test' ||
		process.env.PUBLIC_ENVIRONMENT === 'test' ||
		process.env.PLAYWRIGHT_TEST === 'true'
	) {
		return;
	}

	try {
		const jobId = `game-${gameId}`;
		const job = await gameExpirationQueueManager.queueInstance?.getJob(jobId);
		if (job) {
			await job.remove();
			logger.debug(`Cancelled game expiration job for ${gameId}`);
		}
	} catch (error) {
		logger.error(`Failed to cancel game expiration for ${gameId}:`, error);
		// Don't throw - this is a cleanup operation
	}
};
