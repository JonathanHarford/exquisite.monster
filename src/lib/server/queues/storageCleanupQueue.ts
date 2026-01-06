import { addJob } from '$lib/server/services/queueService';
import { cleanupTemporaryFiles, cleanupOrphanedFiles } from '../services/storageCleanupService.js';
import { logger } from '../logger.js';

// Storage cleanup job processor
export interface StorageCleanupJobData {
	type: 'temporary' | 'orphaned';
	bucketName?: string;
	directory?: string;
	maxAgeHours?: number;
	dryRun?: boolean;
}

export const processStorageCleanup = async (data: StorageCleanupJobData): Promise<void> => {
	const {
		type,
		bucketName = 'epyc-storage',
		directory = 'turns',
		maxAgeHours = 24,
		dryRun = false
	} = data;

	logger.info(`Processing storage cleanup job: ${type} cleanup for ${bucketName}/${directory}`, {
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
			type,
			cleaned: result.cleaned,
			errors: result.errors,
			totalSize: result.totalSize,
			details: result.details.slice(0, 5) // Log first 5 details
		});
	} catch (error) {
		logger.error(`Storage cleanup job failed`, error, {
			type,
			bucketName,
			directory
		});
		throw error;
	}
};

// Export initialization function (No-op)
export const initializeStorageCleanupQueue = async (): Promise<void> => {
	// No-op
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
		await addJob('storage-cleanup', jobData, {
			delay,
			jobId: `temp-cleanup-${bucketName}-${directory}-${Date.now()}`
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
		await addJob('storage-cleanup', jobData, {
			delay,
			jobId: `orphaned-cleanup-${bucketName}-${directory}-${Date.now()}`
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
 * Note: Since moving to Database Queue, use Vercel Cron to trigger these periodically.
 * This function is kept for reference or manual invocation.
 */
export const scheduleRecurringCleanup = async (): Promise<void> => {
	logger.warn('Recurring cleanup jobs should be configured via Vercel Cron. This function is a placeholder.');
	return;
};
