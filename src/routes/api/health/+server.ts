import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';
import { prisma } from '$lib/server/prisma.js';

export async function GET() {
	try {
		const healthChecks = await Promise.allSettled([
			// Database health check
			prisma.$queryRaw`SELECT 1 as health`
		]);

		const dbResult = healthChecks[0];

		const dbHealthy = dbResult.status === 'fulfilled';

		const response = {
			status: dbHealthy ? 'healthy' : 'unhealthy',
			timestamp: new Date().toISOString(),
			services: {
				database: {
					status: dbHealthy ? 'healthy' : 'unhealthy',
					error: dbResult.status === 'rejected' ? dbResult.reason?.message : undefined
				}
			}
		};

		// Log unhealthy services
		if (!dbHealthy) {
			logger.warn('Health check detected unhealthy services:', {
				database: dbHealthy
			});
		}

		return json(response, {
			status: dbHealthy ? 200 : 503
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
