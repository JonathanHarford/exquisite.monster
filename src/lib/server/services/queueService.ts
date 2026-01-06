import { prisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import type { Job } from '@prisma/client';

export type JobHandler<T = any> = (payload: T) => Promise<void>;

export interface AddJobOptions {
	delay?: number;
	jobId?: string; // Maps to 'key' for deduplication
}

/**
 * Add a job to the database queue
 */
export const addJob = async (
	type: string,
	payload: any,
	options: AddJobOptions = {}
): Promise<void> => {
	const runAt = options.delay ? new Date(Date.now() + options.delay) : new Date();

	try {
		await prisma.job.create({
			data: {
				type,
				payload,
				runAt,
				key: options.jobId
			}
		});
		logger.debug(`Queued job ${type}`, {
			key: options.jobId,
			runAt,
			delay: options.delay
		});
	} catch (error: any) {
		// Unique constraint violation (P2002) means job with this key already exists
		if (error.code === 'P2002') {
			logger.debug(`Job ${options.jobId} already exists, skipping.`);
			return;
		}
		logger.error(`Failed to queue job ${type}`, error);
		throw error;
	}
};

/**
 * Remove a job by its unique key (jobId)
 */
export const removeJob = async (jobId: string): Promise<void> => {
	try {
		await prisma.job.delete({
			where: { key: jobId }
		});
		logger.debug(`Removed job with key ${jobId}`);
	} catch (error: any) {
		if (error.code === 'P2025') {
			// Record to delete does not exist
			logger.debug(`Job with key ${jobId} not found, could not remove.`);
			return;
		}
		logger.error(`Failed to remove job ${jobId}`, error);
	}
};

/**
 * Process pending jobs
 * @param handlers Map of job types to handler functions
 * @param batchSize Number of jobs to process in one go
 */
export const processJobs = async (
	handlers: Record<string, JobHandler>,
	batchSize = 50
): Promise<{ processed: number; errors: number }> => {
	const now = new Date();
	let processedCount = 0;
	let errorCount = 0;

	try {
		// Lock and fetch pending jobs using raw query for SKIP LOCKED support
		// This requires Postgres.
		const jobs = await prisma.$queryRaw<Job[]>`
			UPDATE jobs
			SET status = 'processing', "updatedAt" = NOW()
			WHERE id IN (
				SELECT id
				FROM jobs
				WHERE status = 'pending'
				AND "runAt" <= ${now}
				ORDER BY "runAt" ASC
				LIMIT ${batchSize}
				FOR UPDATE SKIP LOCKED
			)
			RETURNING *;
		`;

		if (jobs.length === 0) {
			return { processed: 0, errors: 0 };
		}

		logger.info(`Processing ${jobs.length} jobs...`);

		// Process jobs in parallel (or sequential if strictly required, but parallel is usually better for IO bound)
		// We'll do Promise.all but catch individual errors
		await Promise.all(
			jobs.map(async (job) => {
				const handler = handlers[job.type];
				if (!handler) {
					logger.error(`No handler registered for job type: ${job.type}`);
					await markJobFailed(job.id, `No handler for type ${job.type}`);
					errorCount++;
					return;
				}

				try {
					await handler(job.payload);
					await markJobCompleted(job.id);
					processedCount++;
				} catch (error: any) {
					logger.error(`Job ${job.id} (${job.type}) failed:`, error);
					await markJobFailed(job.id, error.message || String(error));
					errorCount++;
				}
			})
		);
	} catch (error) {
		logger.error('Error fetching/locking jobs:', error);
		// Rethrow or just return stats?
		throw error;
	}

	return { processed: processedCount, errors: errorCount };
};

const markJobCompleted = async (id: string) => {
	await prisma.job.update({
		where: { id },
		data: { status: 'completed' }
	});
};

const markJobFailed = async (id: string, error: string) => {
	// We could add an 'error' column to the Job table later if needed.
	// For now, we assume status 'failed' is enough, or we log it.
	// Optionally we could retry here (update runAt + backoff), but let's keep it simple: strict failure.
	await prisma.job.update({
		where: { id },
		data: { status: 'failed' } // Logic for retries could be added here
	});
};
