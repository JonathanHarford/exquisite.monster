import { error, redirect, fail } from '@sveltejs/kit';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { uploadToCloud } from '$lib/server/storage';
import { validateImage, optimizeTurnImage } from '$lib/server/imageOptimization';
import type { Actions } from './$types';
import { logger } from '$lib/server/logger';

import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { flagTurnSchema } from '$lib/formSchemata';
import { getPartyById } from '$lib/server/services/partyService';
import { TurnValidator } from '$lib/server/usecases/game/TurnValidator';

export const load = async ({ params, locals }) => {
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
					redirect(302, `/s/${game!.seasonId}`);
				} else {
					redirect(302, `/g/${game!.id}`);
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
	submitWriting: async ({ request, locals, params }) => {
		let game;
		try {
			const content = (await request.formData()).get('content')?.toString().trim();
			if (!content) return fail(400, { error: 'Description required' });

			const validation = await TurnValidator.validate(locals.auth().userId!, params.pendingTurnId!);
			if (!validation.success) {
				const { error: err } = validation;
				if (err === 'game_not_found' || err === 'turn_not_found')
					error(404, 'Turn not found');
				if (err === 'not_your_turn') error(403, 'Not your turn');
				if (err === 'turn_completed') error(403, 'Turn already completed');
				return fail(400, { error: 'Validation failed' }); // Fallback
			}

			game = validation.game;
			await GameUseCases.completeTurn(params.pendingTurnId!, 'writing', content);
		} catch (error) {
			logger.error('Turn submission failed', error, {
				userId: locals.auth().userId,
				pendingTurnId: params.pendingTurnId
			});
			// Return fail() instead of redirecting, so the error is shown on the current page
			return fail(500, { error: 'Submission failed. Please try again.' });
		}

		if (game?.seasonId) {
			redirect(302, `/s/${game.seasonId}`);
		} else {
			redirect(302, `/g/${game?.id}`);
		}
	},

	submitDrawing: async ({ request, params, locals }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file?.size) {
			return fail(400, { error: 'File required' });
		}

		const validation = await TurnValidator.validate(locals.auth().userId!, params.pendingTurnId!);
		if (!validation.success) {
			const { error: err } = validation;
			if (err === 'game_not_found' || err === 'turn_not_found')
				error(404, 'Turn not found');
			if (err === 'not_your_turn') error(403, 'Not your turn');
			if (err === 'turn_completed') error(403, 'Turn already completed');
			return fail(400, { error: 'Validation failed' });
		}
		const game = validation.game;

		const inputBuffer = Buffer.from(await file.arrayBuffer());

		// Validate the image (format, dimensions, aspect ratio)
		const validationResult = await validateImage(inputBuffer);
		if (!validationResult.isValid) {
			logger.warn('Invalid image upload attempt:', {
				turnId: params.pendingTurnId,
				userId: locals.auth().userId,
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
				error: validationResult.error
			});
			return fail(400, { error: validationResult.error || 'Invalid image.' });
		}

		let updatedTurn;
		try {
			logger.info('🔧 Starting image optimization:', {
				turnId: params.pendingTurnId,
				originalFileName: file.name,
				originalSize: file.size,
				fileType: file.type
			});

			// Optimize the image (resize, convert to webp, generate responsive sizes)
			const optimizedImageSet = await optimizeTurnImage(inputBuffer);
			logger.info('✅ Image optimization completed successfully');

			const optimizedBuffer = optimizedImageSet.original.buffer;
			const optimizedFormat = optimizedImageSet.original.format; // should be 'webp' by default from optimizeTurnImage

			// Construct a filename using the turn ID and optimized format
			const fileNameForStorage = `${params.pendingTurnId}.${optimizedFormat}`;

			logger.info('☁️ Starting upload to cloud:', {
				turnId: params.pendingTurnId,
				userId: locals.auth().userId,
				originalFileName: file.name,
				originalSize: file.size,
				optimizedSize: optimizedBuffer.length,
				optimizedFormat,
				compressionRatio: Math.round((1 - optimizedBuffer.length / file.size) * 100),
				fileNameForStorage
			});

			const { path } = await uploadToCloud(
				optimizedBuffer,
				fileNameForStorage,
				'turns',
				'image/webp'
			);
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
			logger.error('Drawing submission - image processing or upload failed:', e, {
				turnId: params.pendingTurnId,
				userId: locals.auth().userId,
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
				errorType: e instanceof Error ? e.constructor.name : 'Unknown',
				errorMessage: e instanceof Error ? e.message : String(e)
			});
			return fail(500, { error: 'Failed to process or upload image. Please try again.' });
		}

		if (game?.seasonId) {
			redirect(302, `/s/${game.seasonId}`);
		} else {
			redirect(302, `/g/${game?.id}`);
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

		redirect(302, `/?flagSuccess=true`);
	}
} satisfies Actions;
