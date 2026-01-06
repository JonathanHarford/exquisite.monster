import { scheduleTemporaryFileCleanup, scheduleOrphanedFileCleanup } from '$lib/server/queues/storageCleanupQueue.js';
import { cleanupTemporaryFiles, cleanupOrphanedFiles } from '$lib/server/services/storageCleanupService.js';
import { logger } from '$lib/server/logger.js';
import { prisma } from '$lib/server/prisma';
import type { RequestEvent } from '@sveltejs/kit';

async function checkAdmin(userId: string | null) {
	if (!userId) return false;
	const player = await prisma.player.findUnique({
		where: { id: userId },
		select: { isAdmin: true }
	});
	return !!player?.isAdmin;
}

interface CleanupOptions {
	type: 'temporary' | 'orphaned';
	bucketName: string;
	directory: string;
	maxAgeHours?: number;
	dryRun?: boolean;
	immediate?: boolean;
}

export async function previewCleanupLogic(event: RequestEvent, options: CleanupOptions) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}

	const { type, bucketName, directory, maxAgeHours = 24, dryRun = false } = options;

	try {
		let result;

		if (type === 'temporary') {
			result = await cleanupTemporaryFiles(bucketName, directory, maxAgeHours);
		} else if (type === 'orphaned') {
			result = await cleanupOrphanedFiles(bucketName, directory, dryRun);
		} else {
			throw new Error('Invalid cleanup type');
		}

		logger.info(`Admin ${userId} performed GET cleanup preview`, {
			type,
			cleaned: result.cleaned,
			errors: result.errors
		});

		return {
			success: true,
			message: `${type} cleanup preview completed`,
			result: {
				cleaned: result.cleaned,
				errors: result.errors,
				totalSize: result.totalSize,
				details: result.details,
				summary: `Found ${result.cleaned} files to clean (${Math.round(result.totalSize / 1024)}KB), ${result.errors} errors`
			}
		};
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logger.error(`Cleanup preview failed for admin ${userId}:`, err);
		throw new Error(`Cleanup preview failed: ${errorMessage}`);
	}
}

export async function runCleanupLogic(event: RequestEvent, options: CleanupOptions) {
	const userId = event.locals.auth().userId;
	if (!await checkAdmin(userId)) {
		throw new Error('Forbidden - Admin access required');
	}

	const {
		type,
		bucketName,
		directory,
		maxAgeHours = 24,
		dryRun = false,
		immediate = false
	} = options;

	logger.info(`Admin ${userId} triggered ${type} cleanup`, {
		bucketName,
		directory,
		maxAgeHours,
		dryRun,
		immediate
	});

	try {
		if (immediate) {
			let result;
			if (type === 'temporary') {
				result = await cleanupTemporaryFiles(bucketName, directory, maxAgeHours);
			} else {
				result = await cleanupOrphanedFiles(bucketName, directory, dryRun);
			}

			logger.info(`Immediate cleanup completed by admin ${userId}`, {
				type,
				cleaned: result.cleaned,
				errors: result.errors,
				totalSize: result.totalSize
			});

			return {
				success: true,
				message: `${type} cleanup completed immediately`,
				result: {
					cleaned: result.cleaned,
					errors: result.errors,
					totalSize: result.totalSize,
					details: result.details
				}
			};
		} else {
			if (type === 'temporary') {
				await scheduleTemporaryFileCleanup(bucketName, directory, maxAgeHours);
			} else {
				await scheduleOrphanedFileCleanup(bucketName, directory, dryRun);
			}

			return {
				success: true,
				message: `${type} cleanup scheduled successfully`,
				scheduled: {
					type,
					bucketName,
					directory,
					...(type === 'temporary' ? { maxAgeHours } : { dryRun })
				}
			};
		}
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logger.error(`Cleanup request failed for admin ${userId}:`, err);
		throw new Error(`Cleanup failed: ${errorMessage}`);
	}
}
