import { json } from '@sveltejs/kit';
import { queueMonitor } from '$lib/server/queues/monitor.js';
import { isRedisAvailable } from '$lib/server/redis.js';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		// Check Redis availability first
		const redisHealthy = await isRedisAvailable();

		if (!redisHealthy) {
			return json(
				{
					status: 'unhealthy',
					redis: { healthy: false },
					queues: {},
					timestamp: new Date().toISOString()
				},
				{ status: 503 }
			);
		}

		// Get queue system health
		const systemHealth = await queueMonitor.getSystemHealth();

		return json(
			{
				status: systemHealth.overallHealthy ? 'healthy' : 'degraded',
				redis: { healthy: true },
				queues: systemHealth.queues,
				summary: systemHealth.summary,
				timestamp: new Date().toISOString()
			},
			{
				status: systemHealth.overallHealthy ? 200 : 503
			}
		);
	} catch (error) {
		console.error('Health check failed:', error);

		return json(
			{
				status: 'error',
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
};
