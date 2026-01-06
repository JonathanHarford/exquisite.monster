import { json } from '@sveltejs/kit';
import { processJobs } from '$lib/server/services/queueService';
import {
	processTurnExpiration,
	processGameExpiration,
	processPartyDeadline
} from '$lib/server/queues/expirationQueue';
import { processEmailJob } from '$lib/server/queues/emailQueue';
import { processStorageCleanup } from '$lib/server/queues/storageCleanupQueue';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';

export const GET = async ({ request }) => {
	// Basic auth check
	const authHeader = request.headers.get('authorization');
	if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const handlers = {
		'turn-expiration': processTurnExpiration,
		'game-expiration': processGameExpiration,
		'party-deadline': processPartyDeadline,
		'email': processEmailJob,
		'storage-cleanup': processStorageCleanup
	};

	try {
		// Process jobs
		const result = await processJobs(handlers);
		return json(result);
	} catch (error) {
		logger.error('Cron job processing failed', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
