import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getCommentsByGameId, createComment } from '$lib/server/services/gameService';
import {
	favoriteGame,
	unfavoriteGame,
	isGameFavorited,
	getGameFavoriteCount
} from '$lib/server/services/gameFavoriteService';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { favoriteSchema, flagTurnSchema } from '$lib/formSchemata';
import { isHLCPlayer } from '$lib/utils/hlc';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { isAdmin } from '$lib/server/services/playerService';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
	const gameId = params.gameId;

	if (!gameId) {
		throw error(400, 'Game ID is required');
	}

	const { self } = await parent();
	const currentUserId = locals.auth().userId;

	const game = self?.isAdmin
		? await GameUseCases.findGameByIdAdmin(gameId)
		: await GameUseCases.findGameById(gameId);

	if (!game) {
		throw error(404, 'Game not found');
	}

	// Uncensored games cannot be viewed by HLC players (unless admin)
	if (game.isLewd && self && isHLCPlayer(self) && !self.isAdmin) {
		throw error(403, 'You cannot view this content');
	}

	const comments = await getCommentsByGameId(gameId);

	let isFavoritedByCurrentUser = false;
	let gameFavCount = 0;

	if (currentUserId) {
		isFavoritedByCurrentUser = await isGameFavorited(currentUserId, gameId);
	}

	gameFavCount = await getGameFavoriteCount(gameId);

	const returnPayload = {
		game,
		comments,
		isFavoritedByCurrentUser,
		gameFavCount
	};

	if (self?.isAdmin) {
		const [gameAnalytics, flagTurnForm] = await Promise.all([
			AdminUseCases.getGameDetails(gameId),
			superValidate(zod4(flagTurnSchema))
		]);
		return {
			...returnPayload,
			gameAnalytics,
			flagTurnForm
		};
	}

	return returnPayload;
};

export const actions: Actions = {
	addComment: async ({ request, params, locals }) => {
		if (!locals.auth().userId) {
			return fail(401, { error: 'Authentication required to comment.' });
		}
		const gameId = params.gameId;
		if (!gameId) {
			return fail(400, { error: 'Game ID is missing.' });
		}

		const formData = await request.formData();
		const text = formData.get('text')?.toString();

		if (!text || text.trim() === '') {
			return fail(400, { error: 'Comment text cannot be empty.', gameId, text });
		}

		try {
			await createComment(gameId, locals.auth().userId, text);
		} catch (e) {
			console.error('Failed to create comment:', e);
			return fail(500, { error: 'Could not create comment.', gameId, text });
		}
	},
	toggleGameFavorite: async ({ request, locals, params }) => {
		if (!locals.auth().userId) {
			return fail(401, { error: 'Unauthorized' });
		}
		const selfId = locals.auth().userId;
		const gameId = params.gameId;
		if (!gameId || typeof gameId !== 'string') {
			return fail(400, { error: 'Game ID is missing or invalid.' });
		}

		const form = await superValidate(request, zod4(favoriteSchema));
		if (!form.valid) {
			return fail(400, { error: 'Invalid action type.' });
		}

		try {
			if (form.data.action === 'favorite') {
				await favoriteGame(selfId, gameId);
				return { success: true, message: 'Game favorited!' };
			} else {
				await unfavoriteGame(selfId, gameId);
				return { success: true, message: 'Game unfavorited!' };
			}
		} catch (err) {
			console.error('Error toggling game favorite:', err);
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			return fail(500, { error: `Failed to update favorite status: ${errorMessage}` });
		}
	},
	confirmFlag: async ({ request, locals }) => {
		const formData = await request.formData();
		const flagId = formData.get('flagId')?.toString();

		if (!flagId) {
			return fail(400, { message: 'Flag ID is required' });
		}

		try {
			await FlagUseCases.confirmFlag(flagId, locals.auth().userId!);
			return { success: true };
		} catch (e) {
			console.error('Error confirming flag:', e);
			return fail(500, { message: 'Failed to confirm flag' });
		}
	},

	rejectFlag: async ({ request, locals }) => {
		const formData = await request.formData();
		const flagId = formData.get('flagId')?.toString();

		if (!flagId) {
			return fail(400, { message: 'Flag ID is required' });
		}

		try {
			await FlagUseCases.rejectFlag(flagId, locals.auth().userId!);
			return { success: true };
		} catch (e) {
			console.error('Error rejecting flag:', e);
			return fail(500, { message: 'Failed to reject flag' });
		}
	},

	finishGame: async ({ params }) => {
		const gameId = params.gameId;

		if (!gameId) {
			return fail(400, { message: 'Game ID is required' });
		}

		try {
			await GameUseCases.completeGame(gameId);
			return { success: true };
		} catch (e) {
			console.error('Error finishing game:', e);
			return fail(500, { message: 'Failed to finish game' });
		}
	},

	killGame: async ({ params, locals }) => {
		const userId = locals.auth().userId;
		if (!userId || !(await isAdmin(userId))) {
			return fail(403, { message: 'You are not authorized to perform this action' });
		}
		const gameId = params.gameId;

		if (!gameId) {
			return fail(400, { message: 'Game ID is required' });
		}

		try {
			await GameUseCases.deleteGame(gameId);
		} catch (e) {
			console.error('Error killing game:', e);
			return fail(500, { message: 'Failed to kill game' });
		}

		redirect(302, '/admin/games');
	},

	toggleLewd: async ({ params, locals }) => {
		const gameId = params.gameId;

		if (!gameId) {
			return fail(400, { message: 'Game ID is required' });
		}

		const userId = locals.auth().userId;
		if (!userId || !(await isAdmin(userId))) {
			return fail(403, { message: 'You are not authorized to perform this action' });
		}

		try {
			await AdminUseCases.toggleGameLewdStatus(gameId);
			return { success: true };
		} catch (e) {
			console.error('Error toggling lewd status:', e);
			return fail(500, { message: 'Failed to toggle lewd status' });
		}
	},

	setPoster: async ({ request, locals, params }) => {
		const gameId = params.gameId;

		if (!gameId) {
			return fail(400, { message: 'Game ID is required' });
		}

		const userId = locals.auth().userId;
		if (!userId || !(await isAdmin(userId))) {
			return fail(403, { message: 'You are not authorized to perform this action' });
		}

		const formData = await request.formData();
		const turnId = formData.get('turnId')?.toString();

		if (!turnId) {
			return fail(400, { message: 'Turn ID is required' });
		}

		try {
			await AdminUseCases.setGamePoster(gameId, turnId);
			return { success: true };
		} catch (e) {
			console.error('Error setting poster:', e);
			return fail(500, { message: 'Failed to set poster' });
		}
	},

	resendCompletion: async ({ params, locals }) => {
		const gameId = params.gameId;

		if (!gameId) {
			return fail(400, { message: 'Game ID is required' });
		}

		const userId = locals.auth().userId;
		if (!userId || !(await isAdmin(userId))) {
			return fail(403, { message: 'You are not authorized to perform this action' });
		}

		try {
			await GameUseCases.resendCompletionNotifications(gameId);
			return { success: true };
		} catch (e) {
			console.error('Error resending completion notifications:', e);
			return fail(500, { message: 'Failed to resend completion notifications' });
		}
	},

	flag: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(flagTurnSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		if (!locals.auth().userId) {
			redirect(302, '/');
		}

		await FlagUseCases.flagTurn(
			form.data.turnId,
			locals.auth().userId,
			form.data.reason,
			form.data.explanation
		);

		return { success: true };
	}
};
