import { previewCleanupLogic, runCleanupLogic } from '$lib/server/remotes/cleanup';
import { query, command, getRequestEvent } from '$app/server';

interface CleanupOptions {
	type: 'temporary' | 'orphaned';
	bucketName: string;
	directory: string;
	maxAgeHours?: number;
	dryRun?: boolean;
	immediate?: boolean;
}

/**
 * Preview cleanup results (Query)
 */
export const previewCleanup = query('unchecked', async (options: CleanupOptions) => {
	const event = getRequestEvent();
	return previewCleanupLogic(event, options);
});

/**
 * Run or schedule cleanup (Command)
 */
export const runCleanup = command('unchecked', async (options: CleanupOptions) => {
	const event = getRequestEvent();
	return runCleanupLogic(event, options);
});
