import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { sseService } from '$lib/server/services/sseService';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.auth().userId;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	let streamController: ReadableStreamDefaultController | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			streamController = controller;

			// Send initial connection message
			try {
				const initialMessage = `event: connected\ndata: {"connected": true}\n\n`;
				controller.enqueue(new TextEncoder().encode(initialMessage));
			} catch (err) {
				logger.error('Failed to send initial SSE message', err);
				controller.close();
				return;
			}

			// Register client with service
			try {
				await sseService.addClient(userId, controller);
			} catch (err) {
				logger.error('Failed to register SSE client', err);
				controller.close();
			}
		},
		async cancel() {
			// Unregister client from service
			if (streamController) {
				await sseService.removeClient(userId, streamController);
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
