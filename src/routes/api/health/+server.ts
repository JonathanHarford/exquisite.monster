import { json } from '@sveltejs/kit';
import { getRedisHealthReport } from '$lib/server/redis.js';
import { logger } from '$lib/server/logger.js';
import { prisma } from '$lib/server/prisma.js';
export async function GET() {
	try {
		const healthChecks = await Promise.allSettled([
			// Database health check
			prisma.$queryRaw`SELECT 1 as health`,

			// Redis health check
			getRedisHealthReport()
		]);

		const dbResult = healthChecks[0];
		const redisResult = healthChecks[1];

		const dbHealthy = dbResult.status === 'fulfilled';
		const redisHealthy = redisResult.status === 'fulfilled' && redisResult.value.isHealthy;

		const response = {
			status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
			timestamp: new Date().toISOString(),
			services: {
				database: {
					status: dbHealthy ? 'healthy' : 'unhealthy',
					error: dbResult.status === 'rejected' ? dbResult.reason?.message : undefined
				},
				redis: {
					status: redisHealthy ? 'healthy' : 'unhealthy',
					details: redisResult.status === 'fulfilled' ? redisResult.value : undefined,
					error: redisResult.status === 'rejected' ? redisResult.reason?.message : undefined
				}
			}
		};

		// Log unhealthy services
		if (!dbHealthy || !redisHealthy) {
			logger.warn('Health check detected unhealthy services:', {
				database: dbHealthy,
				redis: redisHealthy
			});

			// Log detailed Redis diagnostics if Redis is unhealthy
			if (!redisHealthy && redisResult.status === 'fulfilled') {
				logger.warn('Redis diagnostics:', redisResult.value.diagnostics);
			}
		}

		return json(response, {
			status: dbHealthy && redisHealthy ? 200 : 503
		});
	} catch (error) {
		logger.error('Health check failed:', error);
		return json(
			{
				status: 'error',
				timestamp: new Date().toISOString(),
				error: 'Health check failed'
			},
			{ status: 500 }
		);
	}
}
