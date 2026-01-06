import type { PageServerLoad } from './$types';
import { getRecentEvents } from '$lib/server/eventService';
import type { Actions } from './$types';
import { GameUseCases } from '$lib/server/usecases/GameUseCases'; // Keep if actions are still relevant to this page

import { prisma } from '$lib/server/prisma';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	// const metrics = await getDashboardMetrics();
	const events = await getRecentEvents(20); // Load 20 most recent events

	const pendingJobCount = await prisma.job.count({
		where: {
			status: 'pending',
			runAt: {
				lte: new Date()
			}
		}
	});

	return {
		events,
		pendingJobCount
	};
};

// Keeping existing actions if they are still meant to be on a general admin page
// If deleteGame is specific to the /admin/games page, it should be moved there.
// For now, assuming it might be a general admin action.
export const actions: Actions = {
	deleteGame: async ({ request }) => {
		const formData = await request.formData();
		const gameId = formData.get('gameId')?.toString();

		if (!gameId) {
			return { success: false, error: 'Game ID is required' };
		}

		try {
			await GameUseCases.deleteGame(gameId);
			// Consider returning information for a toast notification
			return { success: true, message: `Game ${gameId} deleted successfully.` };
		} catch (error) {
			console.error('Error deleting game:', error);
			return { success: false, error: 'Failed to delete game' };
		}
	},

	processJobs: async ({ fetch }) => {
		const headers: Record<string, string> = {};
		if (env.CRON_SECRET) {
			headers['Authorization'] = `Bearer ${env.CRON_SECRET}`;
		}

		try {
			const response = await fetch('/api/cron/process-jobs', { headers });
			if (!response.ok) {
				const errorData = await response.json();
				return { success: false, error: errorData.error || 'Failed to trigger cron API' };
			}
			const result = await response.json();
			return { success: true, ...result };
		} catch (error) {
			console.error('Error triggering job processing API:', error);
			return { success: false, error: 'Failed to process jobs' };
		}
	}
} satisfies Actions;
