import { error, redirect, fail } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { upload } from '$lib/server/storage';
import type { Actions } from './$types';
import { logger } from '$lib/server/logger';

import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { flagTurnSchema } from '$lib/formSchemata';
import { getPartyById } from '$lib/server/services/partyService';
import { TurnValidator } from '$lib/server/usecases/game/TurnValidator';

export const load = async ({ params, locals }) => {
	const isExpired = await GameUseCases.deleteTurnIfExpired(params.pendingTurnId);
	if (isExpired) {
		redirect(302, resolve('/play'));
	}

	const validation = await TurnValidator.validate(locals.auth().userId!, params.pendingTurnId);

	if (!validation.success) {
		const { error: validationError, game, turn } = validation;
		switch (validationError) {
			case 'game_not_found':
				error(404, { message: 'Game not found', body: { gameId: params.pendingTurnId } });
			case 'turn_not_found':
				error(404, { message: 'Turn not found', body: { turnId: params.pendingTurnId } });
			case 'not_your_turn':
				error(403, {
					message: 'Not your turn',
					body: { turnId: params.pendingTurnId, playerId: turn?.playerId }
				});
			case 'turn_completed':
				if (game!.seasonId) {
					redirect(302, resolve('/s/[seasonId]', { seasonId: game!.seasonId }));
				} else {
					redirect(302, resolve('/g/[gameId]', { gameId: game!.id }));
				}
		}
	}

	const { game, turn } = validation;

	let party;
	if (game!.seasonId) {
		party = await getPartyById(game!.seasonId);
	}

	const previousTurn = game!.turns
		.filter((t) => t.orderIndex < turn!.orderIndex)
		.sort((a, b) => b.orderIndex - a.orderIndex)[0];

	const flagTurnForm = await superValidate(zod4(flagTurnSchema));

	return {
		flagTurnForm,
		previousTurn,
		party
	};
};

export const actions = {
	flag: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(flagTurnSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		if (!locals.auth().userId) {
			redirect(302, resolve('/'));
		}

		try {
			await FlagUseCases.flagTurn(
				form.data.turnId,
				locals.auth().userId,
				form.data.reason,
				form.data.explanation
			);
		} catch (error) {
			logger.error('Flag submission failed', error, {
				userId: locals.auth().userId,
				turnId: form.data.turnId
			});
			return fail(500, { form, message: 'Failed to submit flag. Please try again.' });
		}

		redirect(302, resolve('/') + '?flagSuccess=true');
	}
} satisfies Actions;
