import { MINUTES } from '$lib/datetime.js';
import { logger } from './logger.js';
import { initializeEmailQueue } from './queues/emailQueue.js';
import { initializeExpirationQueues } from './queues/expirationQueue.js';
import { initializeStorageCleanupQueue, scheduleRecurringCleanup } from './queues/storageCleanupQueue.js';
import { queueMonitor } from './queues/monitor.js';
import { GameUseCases } from './usecases/GameUseCases.js';

// Use globalThis to persist across hot reloads in development
const globalKey = Symbol.for('epyc.server.initialized');
const intervalKey = Symbol.for('epyc.server.interval');

// Helper functions to manage global state
const isInitialized = (): boolean => {
	return (globalThis as Record<symbol, unknown>)[globalKey] === true;
};

const setInitialized = (value: boolean): void => {
	(globalThis as Record<symbol, unknown>)[globalKey] = value;
};

const getFallbackInterval = (): NodeJS.Timeout | null => {
	return ((globalThis as Record<symbol, unknown>)[intervalKey] as NodeJS.Timeout | null) || null;
};

const setFallbackInterval = (interval: NodeJS.Timeout | null): void => {
	(globalThis as Record<symbol, unknown>)[intervalKey] = interval;
};

/**
 * Initialize all server-side services that require runtime setup
 * This should be called once when the application starts, not during build
 */
export const initializeServerServices = async (): Promise<void> => {
	// Prevent multiple initializations
	if (isInitialized()) {
		logger.debug('Server services already initialized, skipping...');
		return;
	}

	// Skip initialization during build or test
	if (process.env.NODE_ENV === 'test') {
		logger.debug('Skipping server service initialization in test environment');
		return;
	}

	try {
		logger.info('Initializing server services...');

		// Initialize BullMQ queues
		await Promise.all([
			initializeEmailQueue(), 
			initializeExpirationQueues(),
			initializeStorageCleanupQueue()
		]);

		// Schedule recurring cleanup jobs
		await scheduleRecurringCleanup();

		// Start queue monitoring in production
		if (process.env.NODE_ENV === 'production') {
			queueMonitor.startMonitoring(MINUTES);
		}

		// Start fallback expiration check to catch any missed queue jobs
		// This runs every 5 minutes as a safety net
		const interval = setInterval(async () => {
			try {
				logger.debug('Running fallback expiration check...');
				await GameUseCases.performExpirations();
			} catch (error) {
				logger.error('Fallback expiration check failed:', error);
			}
		}, 5 * MINUTES);
		setFallbackInterval(interval);

		// Setup graceful shutdown handlers
		const gracefulShutdown = async (signal: string) => {
			logger.info(`Received ${signal}, shutting down gracefully...`);
			try {
				// Clear fallback interval
				const currentInterval = getFallbackInterval();
				if (currentInterval) {
					clearInterval(currentInterval);
					setFallbackInterval(null);
				}

				await queueMonitor.shutdownAllQueues();
				process.exit(0);
			} catch (error) {
				logger.error('Error during graceful shutdown:', error);
				process.exit(1);
			}
		};

		process.on('SIGINT', () => gracefulShutdown('SIGINT'));
		process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

		setInitialized(true);
		logger.info('Server services initialized successfully');
	} catch (error) {
		logger.error('Failed to initialize server services:', error);
		// Don't throw - allow the app to start even if some services fail
	}
};

/**
 * Check if server services have been initialized
 */
export const areServerServicesInitialized = (): boolean => {
	return isInitialized();
};
