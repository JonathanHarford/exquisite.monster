import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';

export const load: PageServerLoad = async () => {
	try {
		const game = await GameUseCases.findGameById('g_27L');
		if (!game) {
			throw error(404, 'Game not found');
		}
		return {
			games: [game]
		};
	} catch (err) {
		console.error('Error fetching games:', err);
		throw error(500, 'Failed to fetch games');
	}
};
