import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Check database connectivity
		const isHealthy = await prisma.$queryRaw`SELECT 1`;

		if (isHealthy) {
			return json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				services: {
					database: 'connected'
				}
			});
		} else {
			throw new Error('Database health check failed');
		}
	} catch (error) {
		console.error('Health check failed:', error);

		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: 'Database connection failed'
			},
			{ status: 503 }
		);
	}
};
