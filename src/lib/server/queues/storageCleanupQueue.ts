import { QueueManager, createQueueOptions, createWorkerOptions } from './config.js';
import { cleanupTemporaryFiles, cleanupOrphanedFiles } from '../services/storageCleanupService.js';
import { logger } from '../logger.js';
import { queueMonitor } from './monitor.js';
import type { Job } from 'bullmq';

// Storage cleanup job processor
interface StorageCleanupJobData {
	type: 'temporary' | 'orphaned';
	bucketName?: string;
	directory?: string;
	maxAgeHours?: number;
	dryRun?: boolean;
}

const processStorageCleanup = async (job: Job): Promise<void> => {
	const data: StorageCleanupJobData = job.data;
	const { type, bucketName = 'epyc-storage', directory = 'turns', maxAgeHours = 24, dryRun = false } = data;
	
	logger.info(`Processing storage cleanup job: ${type} cleanup for ${bucketName}/${directory}`, {
		jobId: job.id,
		type,
		bucketName,
		directory,
		maxAgeHours,
		dryRun
	});

	try {
		let result;
		
		if (type === 'temporary') {
			result = await cleanupTemporaryFiles(bucketName, directory, maxAgeHours);
		} else if (type === 'orphaned') {
			result = await cleanupOrphanedFiles(bucketName, directory, dryRun);
		} else {
			throw new Error(`Unknown cleanup type: ${type}`);
		}

		logger.info(`Storage cleanup completed successfully`, {
			jobId: job.id,
			type,
			cleaned: result.cleaned,
			errors: result.errors,
			totalSize: result.totalSize,
			details: result.details.slice(0, 5) // Log first 5 details
		});

		// Update job progress
		await job.updateProgress(100);
	} catch (error) {
		logger.error(`Storage cleanup job failed`, error, {
			jobId: job.id,
			type,
			bucketName,
			directory
		});
		throw error; // Re-throw to allow queue retry mechanism
	}
};

// Create queue manager with custom options for storage cleanup
const storageCleanupQueueManager = new QueueManager(
	'storage-cleanup',
	createQueueOptions({
		defaultJobOptions: {
			removeOnComplete: 20, // Keep more completed jobs for monitoring cleanup history
			removeOnFail: 10,
			attempts: 2, // Fewer retries for cleanup operations
			backoff: {
				type: 'exponential',
				delay: 5000 // Longer delay between retries
			}
		}
	}),
	createWorkerOptions({
		concurrency: 1, // Only one cleanup job at a time to avoid conflicts
		limiter: {
			max: 10, // Lower rate limit for cleanup operations
			duration: 60000 // Per minute
		}
	}),
	processStorageCleanup
);

// Export initialization function
export const initializeStorageCleanupQueue = async (): Promise<void> => {
	await storageCleanupQueueManager.initialize();
	
	// Register with monitoring system
	if (storageCleanupQueueManager.isReady) {
		queueMonitor.registerQueue('storage-cleanup', storageCleanupQueueManager);
	}
};

/**
 * Schedule temporary file cleanup
 * Removes files matching temp patterns older than specified age
 */
export const scheduleTemporaryFileCleanup = async (
	bucketName: string = 'epyc-storage',
	directory: string = 'turns',
	maxAgeHours: number = 24,
	delay: number = 0
): Promise<void> => {
	const jobData: StorageCleanupJobData = {
		type: 'temporary',
		bucketName,
		directory,
		maxAgeHours
	};

	try {
		await storageCleanupQueueManager.addJob('cleanup-temp', jobData, {
			delay,
			jobId: `temp-cleanup-${bucketName}-${directory}-${Date.now()}`,
			priority: 5 // Lower priority than game operations
		});
		
		logger.info(`Scheduled temporary file cleanup for ${bucketName}/${directory}`, {
			maxAgeHours,
			delayMs: delay
		});
	} catch (error) {
		logger.error(`Failed to schedule temporary file cleanup:`, error);
	}
};

/**
 * Schedule orphaned file cleanup (files not referenced in database)
 * More aggressive cleanup - should be run less frequently
 */
export const scheduleOrphanedFileCleanup = async (
	bucketName: string = 'epyc-storage', 
	directory: string = 'turns',
	dryRun: boolean = true,
	delay: number = 0
): Promise<void> => {
	const jobData: StorageCleanupJobData = {
		type: 'orphaned',
		bucketName,
		directory,
		dryRun
	};

	try {
		await storageCleanupQueueManager.addJob('cleanup-orphaned', jobData, {
			delay,
			jobId: `orphaned-cleanup-${bucketName}-${directory}-${Date.now()}`,
			priority: 10 // Lowest priority
		});
		
		logger.info(`Scheduled orphaned file cleanup for ${bucketName}/${directory}`, {
			dryRun,
			delayMs: delay
		});
	} catch (error) {
		logger.error(`Failed to schedule orphaned file cleanup:`, error);
	}
};

/**
 * Schedule recurring cleanup jobs
 * Call this during app initialization to set up automatic cleanup
 */
export const scheduleRecurringCleanup = async (): Promise<void> => {
	// Skip in test environments
	if (
		process.env.NODE_ENV === 'test' ||
		process.env.PUBLIC_ENVIRONMENT === 'test' ||
		process.env.PLAYWRIGHT_TEST === 'true'
	) {
		logger.debug('Skipping recurring cleanup scheduling in test environment');
		return;
	}

	// TEMPORARILY DISABLED after accidentally deleting imported game images
	// TODO: Re-enable after thorough testing of new restrictive patterns
	logger.warn('Recurring cleanup jobs are temporarily disabled for safety after fixing temp file patterns');
	return;

	try {
		// Schedule daily temporary file cleanup (runs every 24 hours)
		await storageCleanupQueueManager.addJob('recurring-temp-cleanup', {
			type: 'temporary',
			bucketName: 'epyc-storage',
			directory: 'turns',
			maxAgeHours: 24
		}, {
			repeat: {
				pattern: '0 2 * * *' // Run at 2 AM daily
			},
			jobId: 'recurring-temp-cleanup',
			priority: 5
		});

		// Schedule weekly orphaned file cleanup (dry run)
		await storageCleanupQueueManager.addJob('recurring-orphaned-cleanup-dryrun', {
			type: 'orphaned',
			bucketName: 'epyc-storage', 
			directory: 'turns',
			dryRun: true
		}, {
			repeat: {
				pattern: '0 3 * * 0' // Run at 3 AM on Sundays (dry run)
			},
			jobId: 'recurring-orphaned-cleanup-dryrun',
			priority: 10
		});

		// Schedule monthly orphaned file cleanup (actual deletion)
		await storageCleanupQueueManager.addJob('recurring-orphaned-cleanup', {
			type: 'orphaned',
			bucketName: 'epyc-storage',
			directory: 'turns', 
			dryRun: false
		}, {
			repeat: {
				pattern: '0 4 1 * *' // Run at 4 AM on the 1st of each month
			},
			jobId: 'recurring-orphaned-cleanup',
			priority: 10
		});

		logger.info('Scheduled recurring storage cleanup jobs');
	} catch (error) {
		logger.error('Failed to schedule recurring cleanup jobs:', error);
	}
};

// Export queue manager for health checks and monitoring
export { storageCleanupQueueManager };