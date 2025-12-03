import type { PageServerLoad } from './$types';
import { getRecentEvents } from '$lib/server/eventService';
import type { Actions } from './$types';
import { GameUseCases } from '$lib/server/usecases/GameUseCases'; // Keep if actions are still relevant to this page

export const load: PageServerLoad = async () => {
	// const metrics = await getDashboardMetrics();
	const events = await getRecentEvents(20); // Load 20 most recent events

	return {
		events
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
	}
	// Add other general admin actions here if needed
} satisfies Actions;
