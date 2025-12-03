import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { error } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ url, locals, parent }) => {
	const { self } = await parent();
	const showLewd = self?.hideLewdContent ? false : true;
	try {
		const filter = (url.searchParams.get('filter') || 'best-all') as
			| 'best-7'
			| 'best-30'
			| 'best-all'
			| 'latest';
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '20');

		// Validate parameters
		if (page < 1 || limit < 1 || limit > 100) {
			throw error(400, 'Invalid pagination parameters');
		}

		const validFilters = ['best-7', 'best-30', 'best-all', 'latest'];
		if (!validFilters.includes(filter)) {
			throw error(400, 'Invalid filter parameter');
		}

		// Get user from parent layout
		const { self } = await parent();

		// Fetch games using the use case
		const result = await GameUseCases.getGamesForGallery({
			filter,
			page,
			limit,
			userId: locals.auth().userId,
			showLewd
		});
		return {
			games: result.games,
			hasMore: result.hasMore,
			total: result.total,
			currentPage: page,
			limit,
			filter,
			self
		};
	} catch (err) {
		console.error('Error fetching games:', err);
		throw error(500, 'Failed to fetch games');
	}
};
