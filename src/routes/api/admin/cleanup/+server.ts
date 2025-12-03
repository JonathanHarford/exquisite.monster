import { json, error } from '@sveltejs/kit';
import { scheduleTemporaryFileCleanup, scheduleOrphanedFileCleanup } from '$lib/server/queues/storageCleanupQueue.js';
import { cleanupTemporaryFiles, cleanupOrphanedFiles } from '$lib/server/services/storageCleanupService.js';
import { logger } from '$lib/server/logger.js';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Enforce admin access using existing security helper
	await locals.security.isAdmin();
	const { userId } = locals.auth();

	try {
		const body = await request.json();
		const { 
			type = 'temporary', 
			bucketName = 'epyc-storage', 
			directory = 'turns',
			maxAgeHours = 24,
			dryRun = false,
			immediate = false
		} = body;

		// Validate type
		if (type !== 'temporary' && type !== 'orphaned') {
			error(400, 'Invalid cleanup type. Must be "temporary" or "orphaned"');
		}

		logger.info(`Admin ${userId} triggered ${type} cleanup`, {
			bucketName,
			directory,
			maxAgeHours,
			dryRun,
			immediate
		});

		let result;

		if (immediate) {
			// Run cleanup immediately and return results
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

			return json({
				success: true,
				message: `${type} cleanup completed immediately`,
				result: {
					cleaned: result.cleaned,
					errors: result.errors,
					totalSize: result.totalSize,
					details: result.details
				}
			});
		} else {
			// Schedule cleanup job
			if (type === 'temporary') {
				await scheduleTemporaryFileCleanup(bucketName, directory, maxAgeHours);
			} else {
				await scheduleOrphanedFileCleanup(bucketName, directory, dryRun);
			}

			return json({
				success: true,
				message: `${type} cleanup scheduled successfully`,
				scheduled: {
					type,
					bucketName,
					directory,
					...(type === 'temporary' ? { maxAgeHours } : { dryRun })
				}
			});
		}
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logger.error(`Cleanup request failed for admin ${userId}:`, err);
		
		error(500, `Cleanup failed: ${errorMessage}`);
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	// Enforce admin access using existing security helper
	await locals.security.isAdmin();
	const { userId } = locals.auth();

	const type = url.searchParams.get('type') || 'temporary';
	const bucketName = url.searchParams.get('bucketName') || 'epyc-storage';
	const directory = url.searchParams.get('directory') || 'turns';
	const maxAgeHours = parseInt(url.searchParams.get('maxAgeHours') || '24');
	const dryRun = url.searchParams.get('dryRun') === 'true';

	try {
		let result;

		if (type === 'temporary') {
			result = await cleanupTemporaryFiles(bucketName, directory, maxAgeHours);
		} else if (type === 'orphaned') {
			result = await cleanupOrphanedFiles(bucketName, directory, dryRun);
		} else {
			error(400, 'Invalid cleanup type. Must be "temporary" or "orphaned"');
		}

		logger.info(`Admin ${userId} performed GET cleanup preview`, {
			type,
			cleaned: result.cleaned,
			errors: result.errors
		});

		return json({
			success: true,
			message: `${type} cleanup preview completed`,
			result: {
				cleaned: result.cleaned,
				errors: result.errors,
				totalSize: result.totalSize,
				details: result.details,
				summary: `Found ${result.cleaned} files to clean (${Math.round(result.totalSize / 1024)}KB), ${result.errors} errors`
			}
		});
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logger.error(`Cleanup preview failed for admin ${userId}:`, err);
		
		error(500, `Cleanup preview failed: ${errorMessage}`);
	}
};