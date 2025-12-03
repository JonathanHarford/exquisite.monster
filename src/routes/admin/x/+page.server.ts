import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { fetchDefaultGameConfig } from '$lib/server/services/configService';
import { createNotification } from '$lib/server/services/notificationService';
import { parseDuration } from '$lib/datetime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.auth().userId;

	return {
		userId
	};
};

export const actions: Actions = {
	sendTestNotification: async ({ locals, request }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Unauthorized' });
		}

		try {
			const formData = await request.formData();
			const targetUserId = formData.get('targetUserId') as string;
			const type = formData.get('type') as string;
			const title = formData.get('title') as string;
			const body = formData.get('body') as string;
			const dataString = formData.get('data') as string;
			const actionUrl = formData.get('actionUrl') as string;

			// Validate required fields
			if (!targetUserId || !type || !title || !body) {
				return fail(400, { error: 'User ID, type, title, and body are required' });
			}

			// Parse optional JSON data
			let data = null;
			if (dataString && dataString.trim()) {
				try {
					data = JSON.parse(dataString);
				} catch {
					return fail(400, { error: 'Invalid JSON in data field' });
				}
			}

			// Create the notification
			await createNotification({
				userId: targetUserId,
				type,
				title, // Keep manual title for test notifications
				body, // Keep manual body for test notifications
				data,
				...(actionUrl && actionUrl.trim() && { actionUrl: actionUrl.trim() }),
				templateData: {
					timestamp: new Date().toLocaleString()
				}
			});

			return { success: true };
		} catch (error) {
			console.error('Error sending test notification:', error);
			return fail(500, { error: 'Failed to send notification' });
		}
	},

	createTestGame1Turn: async ({ locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Unauthorized' });
		}

		try {
			// Get available players for random selection (excluding the current user)
			const players = await prisma.player.findMany({
				where: {
					bannedAt: null,
					id: { not: userId }
				},
				select: { id: true, username: true }
			});

			if (players.length === 0) {
				return fail(500, { error: 'No other players available' });
			}

			const config = await fetchDefaultGameConfig();
			const now = new Date();
			const gameId = `g_test_${now.valueOf().toString(36)}`;

			// Create game with config
			await prisma.game.create({
				data: {
					id: gameId,
					expiresAt: new Date(now.valueOf() + parseDuration(config.gameTimeout)),
					config: {
						create: {
							id: gameId,
							minTurns: config.minTurns,
							maxTurns: config.maxTurns,
							writingTimeout: config.writingTimeout,
							drawingTimeout: config.drawingTimeout,
							gameTimeout: config.gameTimeout
						}
					}
				}
			});

			// Select a random player for the first turn
			const randomPlayer = players[Math.floor(Math.random() * players.length)];

			// Create the first turn with the test sentence
			await prisma.turn.create({
				data: {
					id: `t_${gameId}_0`,
					gameId: gameId,
					playerId: randomPlayer.id,
					content: 'The cat sat on the mat',
					isDrawing: false,
					orderIndex: 0,
					completedAt: now
				}
			});

			return { success: true, gameId };
		} catch (error) {
			console.error('Error creating 1-turn test game:', error);
			return fail(500, { error: 'Failed to create test game' });
		}
	},

	createTestGame2Turns: async ({ locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Unauthorized' });
		}

		try {
			// Get available players for random selection (excluding the current user)
			const players = await prisma.player.findMany({
				where: {
					bannedAt: null,
					id: { not: userId }
				},
				select: { id: true, username: true }
			});

			if (players.length < 2) {
				return fail(500, { error: 'Need at least 2 other players for 2-turn game' });
			}

			const config = await fetchDefaultGameConfig();
			const now = new Date();
			const gameId = `g_test_${now.valueOf().toString(36)}`;

			// Create game with config
			await prisma.game.create({
				data: {
					id: gameId,
					expiresAt: new Date(now.valueOf() + parseDuration(config.gameTimeout)),
					config: {
						create: {
							id: gameId,
							minTurns: config.minTurns,
							maxTurns: config.maxTurns,
							writingTimeout: config.writingTimeout,
							drawingTimeout: config.drawingTimeout,
							gameTimeout: config.gameTimeout
						}
					}
				}
			});

			// Select two different random players
			const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
			const player1 = shuffledPlayers[0];
			const player2 = shuffledPlayers[1];

			// Create the first turn with the test sentence
			await prisma.turn.create({
				data: {
					id: `t_${gameId}_0`,
					gameId: gameId,
					playerId: player1.id,
					content: 'The cat sat on the mat',
					isDrawing: false,
					orderIndex: 0,
					completedAt: new Date(now.valueOf() - 60000) // 1 minute ago
				}
			});

			// Create the second turn with the test image
			await prisma.turn.create({
				data: {
					id: `t_${gameId}_1`,
					gameId: gameId,
					playerId: player2.id,
					content: '/img/x/tcsotm.jpg',
					isDrawing: true,
					orderIndex: 1,
					completedAt: now
				}
			});

			return { success: true, gameId };
		} catch (error) {
			console.error('Error creating 2-turn test game:', error);
			return fail(500, { error: 'Failed to create test game' });
		}
	}
};
