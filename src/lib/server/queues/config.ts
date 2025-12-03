import {
	Queue,
	Worker,
	type QueueOptions,
	type WorkerOptions,
	type JobsOptions
} from 'bullmq';
import type { Job } from 'bullmq';
import { redis, isRedisAvailable } from '$lib/server/redis.js';
import { logger } from '$lib/server/logger.js';

// Create separate connection strategies for Queues vs Workers
// Queues should fail fast (for HTTP requests), Workers should be persistent
const getQueueRedisConnection = () => {
	// Clone the existing redis client for BullMQ Queues
	// Keep enableOfflineQueue: false for fail-fast behavior
	return redis.duplicate({
		maxRetriesPerRequest: 3, // Allow limited retries for queue operations
		lazyConnect: true,
		enableOfflineQueue: false, // Fail fast for queue operations (HTTP endpoints)
		// Enhanced reconnection strategy for queues
		reconnectOnError: (err: Error) => {
			const targetError =
				err.message.includes('READONLY') ||
				err.message.includes('EPIPE') ||
				err.message.includes('ECONNRESET') ||
				err.message.includes('ETIMEDOUT') ||
				err.message.includes('Connection is closed');
			if (targetError) {
				logger.debug('Queue Redis reconnecting due to error:', err.message);
				return true;
			}
			return false;
		},
		retryStrategy: (times: number) => {
			// Faster retry for queues (fail faster)
			const maxDelay = 2000; // Max 2 seconds between retries
			const baseDelay = 100;

			if (times > 5) {
				logger.debug('Queue Redis retry limit exceeded after 5 attempts');
				return null; // Stop retrying after 5 attempts
			}

			const delay = Math.min(baseDelay * Math.pow(2, times), maxDelay);
			return delay;
		}
	});
};

const getWorkerRedisConnection = () => {
	// Clone the existing redis client for BullMQ Workers
	// Workers should be more persistent and wait for reconnection
	return redis.duplicate({
		maxRetriesPerRequest: null, // Required for BullMQ workers - never give up
		lazyConnect: true,
		enableOfflineQueue: true, // Allow queuing for workers during disconnections
		// Enhanced reconnection strategy for workers
		reconnectOnError: (err: Error) => {
			const targetError =
				err.message.includes('READONLY') ||
				err.message.includes('EPIPE') ||
				err.message.includes('ECONNRESET') ||
				err.message.includes('ETIMEDOUT') ||
				err.message.includes('ENOTFOUND') ||
				err.message.includes('Connection is closed');
			if (targetError) {
				logger.info('Worker Redis reconnecting due to error:', err.message);
				return true;
			}
			return false;
		},
		retryStrategy: (times: number) => {
			// More persistent retry for workers
			const maxDelay = 20000; // Max 20 seconds between retries
			const baseDelay = 1000; // Start with 1 second

			// Workers should retry indefinitely
			const delay = Math.min(baseDelay * Math.pow(1.5, times), maxDelay);
			logger.debug(`Worker Redis retry attempt ${times}, delay: ${delay}ms`);
			return delay;
		},
		// Keep connection alive for workers
		keepAlive: 30000,
		// Enhanced command timeout for workers
		commandTimeout: 60000 // 60 seconds for worker operations
	});
};

// Separate connection pools for better resource management
let queueConnection: ReturnType<typeof getQueueRedisConnection> | null = null;
let workerConnection: ReturnType<typeof getWorkerRedisConnection> | null = null;

const getQueueConnection = () => {
	if (!queueConnection) {
		queueConnection = getQueueRedisConnection();

		// Add enhanced error handling for queue connections
		queueConnection.on('error', (err) => {
			logger.debug('Queue Redis connection error:', err.message);
		});

		queueConnection.on('close', () => {
			logger.debug('Queue Redis connection closed');
		});

		queueConnection.on('reconnecting', () => {
			logger.debug('Queue Redis reconnecting...');
		});
	}
	return queueConnection;
};

const getWorkerConnection = () => {
	if (!workerConnection) {
		workerConnection = getWorkerRedisConnection();

		// Add enhanced error handling for worker connections
		workerConnection.on('error', (err) => {
			logger.info('Worker Redis connection error:', err.message);
		});

		workerConnection.on('close', () => {
			logger.info('Worker Redis connection closed, will reconnect');
		});

		workerConnection.on('reconnecting', () => {
			logger.info('Worker Redis reconnecting...');
		});

		workerConnection.on('ready', () => {
			logger.info('Worker Redis connection ready');
		});
	}
	return workerConnection;
};

// Base queue options - optimized for fail-fast behavior
export const createQueueOptions = (overrides: Partial<QueueOptions> = {}): QueueOptions => ({
	connection: getQueueConnection(),
	defaultJobOptions: {
		removeOnComplete: 100, // Keep last 100 completed jobs for monitoring
		removeOnFail: 50, // Keep last 50 failed jobs for debugging
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 2000
		},
		...overrides.defaultJobOptions
	},
	...overrides
});

// Base worker options - optimized for persistence and reliability
export const createWorkerOptions = (overrides: Partial<WorkerOptions> = {}): WorkerOptions => ({
	connection: getWorkerConnection(),
	concurrency: 5,
	stalledInterval: 30000, // Check for stalled jobs every 30s (default)
	maxStalledCount: 1, // Max number of times a job can be stalled
	limiter: {
		max: 100,
		duration: 1000
	},
	...overrides
});

// Global registry to prevent duplicate workers during hot reloads
const globalQueueKey = Symbol.for('epyc.queues.registry');
const getGlobalQueueRegistry = (): Map<string, QueueManager> => {
	if (!(globalThis as Record<symbol, unknown>)[globalQueueKey]) {
		(globalThis as Record<symbol, unknown>)[globalQueueKey] = new Map();
	}
	return (globalThis as Record<symbol, unknown>)[globalQueueKey] as Map<string, QueueManager>;
};

// Enhanced queue manager class with better error handling and monitoring
export class QueueManager {
	private queue: Queue | null = null;
	private worker: Worker | null = null;
	private isInitialized = false;

	constructor(
		private queueName: string,
		private queueOptions: QueueOptions = createQueueOptions(),
		private workerOptions?: WorkerOptions,
		private workerProcessor?: (job: Job) => Promise<void>
	) {
		// Check if this queue already exists in the global registry
		const registry = getGlobalQueueRegistry();
		const existing = registry.get(queueName);
		if (existing && existing.isReady) {
			logger.debug(`Queue ${queueName} already exists in global registry, reusing...`);
			// Copy the existing state
			this.queue = existing.queue;
			this.worker = existing.worker;
			this.isInitialized = existing.isInitialized;
		} else {
			// Register this instance
			registry.set(queueName, this);
		}
	}

	async initialize(): Promise<void> {
		// Skip initialization during test or if already initialized
		if (
			process.env.NODE_ENV === 'test' ||
			process.env.PUBLIC_ENVIRONMENT === 'test' ||
			process.env.PLAYWRIGHT_TEST === 'true' ||
			this.isInitialized
		) {
			logger.debug(`Queue ${this.queueName} already initialized, skipping...`);
			return;
		}

		try {
			const redisReady = await isRedisAvailable();
			if (redisReady) {
				this.queue = new Queue(this.queueName, this.queueOptions);
				this.isInitialized = true;
				logger.info(`${this.queueName} queue initialized successfully`);

				// Initialize worker if processor is provided
				if (this.workerProcessor && this.workerOptions) {
					this.worker = new Worker(this.queueName, this.workerProcessor, this.workerOptions);

					// Enhanced error handling for worker
					this.worker.on('error', (error) => {
						const err = error as Error & { code?: string };

						// Provide detailed error context
						const errorContext = {
							message: err.message,
							code: err.code,
							queueName: this.queueName,
							redisStatus: getWorkerConnection().status,
							timestamp: new Date().toISOString()
						};

						if (err.code === 'ETIMEDOUT' || err.message.includes('Command timed out')) {
							logger.warn(`Worker timeout in ${this.queueName}, will retry`);
							logger.warn('Timeout details:', errorContext);
						} else if (err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')) {
							logger.warn(`Worker connection reset in ${this.queueName}, will reconnect`);
							logger.warn('Connection reset details:', errorContext);
						} else if (err.message.includes("Stream isn't writeable")) {
							logger.error(
								`Redis stream not writeable in ${this.queueName} - connection lost during operation`
							);
							logger.error('Stream error details:', errorContext);
						} else if (err.message.includes('enableOfflineQueue options is false')) {
							logger.error(
								`Offline queue disabled in ${this.queueName} - cannot queue operations while Redis is disconnected`
							);
						} else {
							logger.error(`Unexpected worker error in ${this.queueName}`, errorContext);
						}
					});

					this.worker.on('failed', (job, err) => {
						logger.error(`Job failed in ${this.queueName}:`, err, {
							jobId: job?.id,
							jobName: job?.name,
							attempts: job?.attemptsMade
						});
					});

					this.worker.on('stalled', (jobId) => {
						logger.warn(`Job stalled in ${this.queueName}:`, { jobId });
					});

					// Add monitoring events
					this.worker.on('completed', (job) => {
						logger.debug(`Job completed in ${this.queueName}:`, {
							jobId: job.id,
							jobName: job.name,
							processingTime: job.finishedOn ? job.finishedOn - job.processedOn! : 0
						});
					});

					this.worker.on('progress', (job, progress) => {
						logger.debug(`Job progress in ${this.queueName}:`, {
							jobId: job.id,
							progress
						});
					});
				}
			} else {
				logger.warn(`Redis not available - ${this.queueName} queue disabled`);
			}
		} catch (error) {
			logger.error(`Failed to initialize ${this.queueName} queue:`, error);
		}
	}

	get queueInstance(): Queue | null {
		return this.queue;
	}

	async addJob(jobName: string, data: object, options: JobsOptions = {}): Promise<void> {
		// Skip queue operations during tests
		if (
			process.env.NODE_ENV === 'test' ||
			process.env.PUBLIC_ENVIRONMENT === 'test' ||
			process.env.PLAYWRIGHT_TEST === 'true'
		) {
			return;
		}

		// Ensure queue is initialized
		if (!this.isInitialized) {
			logger.warn(
				`Queue ${this.queueName} not initialized, attempting to initialize for job ${jobName}`
			);
			await this.initialize();
		}

		if (!this.queue) {
			logger.warn(
				`Cannot add job ${jobName} - ${this.queueName} queue not available (Redis may be unavailable or initialization failed)`
			);
			return;
		}

		try {
			const job = await this.queue.add(jobName, data, options);
			logger.debug(`Queued ${jobName} job in ${this.queueName}:`, {
				jobId: job.id,
				delay: options.delay,
				priority: options.priority
			});
		} catch (error) {
			const err = error as Error & { code?: string };

			// Provide detailed error context
			const errorContext = {
				message: err.message,
				code: err.code,
				jobName,
				queueName: this.queueName,
				redisStatus: getWorkerConnection().status,
				timestamp: new Date().toISOString(),
				isInitialized: this.isInitialized,
				queueExists: !!this.queue
			};

			if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
				logger.warn(
					`Failed to queue ${jobName} job due to connection issue - will retry initialization`
				);
				logger.warn('Connection issue details:', errorContext);
				// Attempt to reinitialize the queue
				this.isInitialized = false;
				setTimeout(() => this.initialize(), 3000);
			} else if (err.message.includes("Stream isn't writeable")) {
				logger.error(`Cannot queue ${jobName} job - Redis stream not writeable`, errorContext);
			} else if (err.message.includes('enableOfflineQueue options is false')) {
				logger.warn(`Cannot queue ${jobName} job - Redis offline and offline queue disabled`);
				logger.warn('Offline queue details:', errorContext);
				logger.warn('Job will be skipped until Redis connection is restored');
			} else {
				logger.error(`Failed to queue ${jobName} job in ${this.queueName}`, errorContext);
			}
		}
	}

	// Add queue health check method
	async getHealthStatus(): Promise<{
		isHealthy: boolean;
		queueStats?: {
			waiting: number;
			active: number;
			completed: number;
			failed: number;
		};
		workerStats?: {
			active: number;
			completed: number;
		};
	}> {
		if (!this.isInitialized || !this.queue) {
			return { isHealthy: false };
		}

		try {
			const [waiting, active, completed, failed] = await Promise.all([
				this.queue.getWaiting(),
				this.queue.getActive(),
				this.queue.getCompleted(),
				this.queue.getFailed()
			]);

			return {
				isHealthy: true,
				queueStats: {
					waiting: waiting.length,
					active: active.length,
					completed: completed.length,
					failed: failed.length
				}
			};
		} catch (error) {
			logger.error(`Health check failed for ${this.queueName}:`, error);
			return { isHealthy: false };
		}
	}

	// Graceful shutdown method
	async close(): Promise<void> {
		if (this.worker) {
			await this.worker.close();
			this.worker = null;
		}
		if (this.queue) {
			await this.queue.close();
			this.queue = null;
		}
		this.isInitialized = false;

		// Remove from global registry
		const registry = getGlobalQueueRegistry();
		registry.delete(this.queueName);

		logger.info(`${this.queueName} queue closed gracefully`);
	}

	get isReady(): boolean {
		return this.isInitialized && this.queue !== null;
	}
}
