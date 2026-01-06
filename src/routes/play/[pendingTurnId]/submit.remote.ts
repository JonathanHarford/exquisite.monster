import { form, getRequestEvent } from '$app/server';
import { error, redirect, fail } from '@sveltejs/kit';
import { TurnValidator } from '$lib/server/usecases/game/TurnValidator';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { resolve } from '$app/paths';
import { logger } from '$lib/server/logger';
import { upload } from '$lib/server/storage';

export const submitWriting = form('unchecked', async (data: { content?: string }) => {
	const event = getRequestEvent();
	const { locals, params } = event;

	let game;
	try {
		const content = data.content?.trim();
		if (!content) return fail(400, { error: 'Description required' });

		const validation = await TurnValidator.validate(locals.auth().userId!, params.pendingTurnId!);
		if (!validation.success) {
			const { error: err } = validation;
			if (err === 'game_not_found' || err === 'turn_not_found') error(404, 'Turn not found');
			if (err === 'not_your_turn') error(403, 'Not your turn');
			if (err === 'turn_completed') error(403, 'Turn already completed');
			return fail(400, { error: 'Validation failed' }); // Fallback
		}

		game = validation.game;
		await GameUseCases.completeTurn(params.pendingTurnId!, 'writing', content);
	} catch (err) {
		logger.error('Turn submission failed', err, {
			userId: locals.auth().userId,
			pendingTurnId: params.pendingTurnId
		});
		// Return fail() instead of redirecting, so the error is shown on the current page
		return fail(500, { error: 'Submission failed. Please try again.' });
	}

	if (game?.seasonId) {
		redirect(302, resolve('/s/[seasonId]', { seasonId: game.seasonId }));
	} else {
		redirect(302, resolve('/g/[gameId]', { gameId: game?.id }));
	}
});

export const submitDrawing = form('unchecked', async (data: { file?: File }) => {
	const event = getRequestEvent();
	const { locals, params } = event;

	const file = data.file;

	if (!file?.size) {
		return fail(400, { error: 'File required' });
	}

	const validation = await TurnValidator.validate(locals.auth().userId!, params.pendingTurnId!);
	if (!validation.success) {
		const { error: err } = validation;
		if (err === 'game_not_found' || err === 'turn_not_found') error(404, 'Turn not found');
		if (err === 'not_your_turn') error(403, 'Not your turn');
		if (err === 'turn_completed') error(403, 'Turn already completed');
		return fail(400, { error: 'Validation failed' });
	}
	const game = validation.game;

	let updatedTurn;
	try {
		logger.info('☁️ Starting upload to cloud:', {
			turnId: params.pendingTurnId,
			userId: locals.auth().userId,
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type
		});

		// We use the turn ID as the prefix.
		// The upload function returns { path: string } which is the public URL.
		const { path } = await upload(file, params.pendingTurnId!);

		logger.info('✅ Upload to cloud completed successfully:', { path });

		logger.info('💾 Starting database turn completion');
		updatedTurn = await GameUseCases.completeTurn(params.pendingTurnId!, 'drawing', path);
		logger.info('✅ Database turn completion successful');

		logger.info('Turn drawing submitted successfully:', {
			turnId: params.pendingTurnId,
			gameId: updatedTurn.gameId,
			userId: locals.auth().userId,
			imagePath: path
		});
	} catch (e) {
		logger.error('Drawing submission - upload failed:', e, {
			turnId: params.pendingTurnId,
			userId: locals.auth().userId,
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
			errorType: e instanceof Error ? e.constructor.name : 'Unknown',
			errorMessage: e instanceof Error ? e.message : String(e)
		});
		return fail(500, { error: 'Failed to upload image. Please try again.' });
	}

	if (game?.seasonId) {
		redirect(302, resolve('/s/[seasonId]', { seasonId: game.seasonId }));
	} else {
		redirect(302, resolve('/g/[gameId]', { gameId: game?.id }));
	}
});
