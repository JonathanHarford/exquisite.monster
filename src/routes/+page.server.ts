import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ locals, parent }) => {
	const { self } = await parent();
	const showLewd = self?.hideLewdContent ? false : true;

	try {
		// Fetch top 4 games for the home page gallery
		const result = await GameUseCases.getGamesForGallery({
			filter: 'best-all',
			page: 1,
			limit: 4,
			userId: locals.auth().userId,
			showLewd
		});

		return {
			games: result.games
		};
	} catch (err) {
		console.error('Error fetching games for home page:', err);
		// Return empty games array on error rather than throwing
		return {
			games: []
		};
	}
};
