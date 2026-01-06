import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { Actions, PageServerLoad } from './$types';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import type { Turn } from '$lib/types/domain';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const userId = locals.auth().userId;
	if (!userId) {
		redirect(302, resolve('/'));
	}

	// Check if user has pending turns - redirect to stalest valid turn
	const pendingTurn = await GameUseCases.findStalestValidPendingTurn(userId);
	if (pendingTurn) {
		redirect(302, resolve('/play/[pendingTurnId]', { pendingTurnId: pendingTurn.id }));
	}

	// Get user data from parent layout
	const { self } = await parent();

	// Check what types of games are available for the player
	const availableGameTypes = await GameUseCases.checkAvailableGameTypes(userId);

	// No pending turn found, show the start turn page
	return { self, availableGameTypes };
};

export const actions = {
	startTurn: async ({ locals, request }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			redirect(302, resolve('/'));
		}

		// Check if user has pending turns - redirect to stalest valid turn
		const pendingTurn = await GameUseCases.findStalestValidPendingTurn(userId);
		if (pendingTurn) {
			// User has pending turns, redirect to the stalest one
			redirect(302, resolve('/play/[pendingTurnId]', { pendingTurnId: pendingTurn.id }));
		}

		const formData = await request.formData();
		const isLewdStr = formData.get('isLewd')?.toString();
		const turnTypeStr = formData.get('turnType')?.toString();

		const options: { isLewd?: boolean; turnType?: 'first' | 'writing' | 'drawing' } = {};

		if (isLewdStr === 'true') {
			options.isLewd = true;
		} else if (isLewdStr === 'false') {
			options.isLewd = false;
		}

		if (turnTypeStr === 'first' || turnTypeStr === 'writing' || turnTypeStr === 'drawing') {
			options.turnType = turnTypeStr;
		}

		let turn: Turn;
		try {
			turn = await GameUseCases.createTurnAndMaybeGame(userId, options);
		} catch (error) {
			// If there's an error (like "Pending game found"), redirect to check status
			console.error('Error creating turn:', error);
			redirect(302, resolve('/play'));
		}
		redirect(302, resolve('/play/[pendingTurnId]', { pendingTurnId: turn.id }));
	}
} satisfies Actions;
