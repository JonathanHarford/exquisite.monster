import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { FlagUseCases } from '$lib/server/usecases/FlagUseCases';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { prisma } from '$lib/server/prisma';
import type { Player, Turn } from '@prisma/client';
import type { GameConfig } from '$lib/types/domain';
import { getPlayers, getAdmin, replaceDefaultConfig } from './helpers';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { SECONDS, DAYS, formatDuration } from '$lib/datetime';
import { createNotification } from '$lib/server/services/notificationService';
import { EmailService } from '$lib/server/services/emailService';
import type { UserResource } from '@clerk/types';

// Mock the dev environment for testing dev mode behavior
vi.mock('$app/environment', () => ({
	dev: true // Set to true for testing dev behavior
}));

// Mock Clerk
vi.mock('svelte-clerk/server', () => ({
	clerkClient: {
		users: {
			getUser: vi.fn()
		}
	}
}));

import { clerkClient } from 'svelte-clerk/server';
const mockGetUser = vi.mocked(clerkClient.users.getUser);

const minTurns = 2;
const maxTurns = 4;
const writingTimeout = 5 * SECONDS;
const drawingTimeout = 15 * SECONDS;
const gameTimeout = 1 * DAYS;
const testConfig = {
	minTurns,
	maxTurns,
	writingTimeout: formatDuration(writingTimeout),
	drawingTimeout: formatDuration(drawingTimeout),
	gameTimeout: formatDuration(gameTimeout),
	isLewd: false
};

describe('Email Notifications', () => {
	let players: Player[] = [];
	let adminPlayer: Player;
	let defaultConfig: GameConfig;
	let firstTurn: Turn;

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
		adminPlayer = await getAdmin(allUsers);
		defaultConfig = await replaceDefaultConfig(testConfig);
	});

	afterAll(async () => {
		await replaceDefaultConfig(defaultConfig);
		console.log('🧪 Restored default config');
	});

	beforeEach(async () => {
		// Clean up any existing data
		await prisma.$transaction([
			prisma.notification.deleteMany(),
			prisma.turnFlag.deleteMany(),
			prisma.turn.deleteMany(),
			prisma.game.deleteMany()
		]);

		// Create a basic game setup for each test
		firstTurn = await GameUseCases.createTurnAndMaybeGame(players[0].id);
		await GameUseCases.completeTurn(firstTurn.id, 'writing', 'test sentence');
	});

	describe('Flag Notification Creation', () => {
		it('should create admin notifications when a flag is made', async () => {
			// Player 2 joins the game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toBe(firstTurn.gameId);

			// Player 2 flags the first turn
			const reason = 'spam';
			const explanation = 'This looks like spam content';
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, reason, explanation);

			// Verify that admin notifications were created
			const adminNotifications = await prisma.notification.findMany({
				where: {
					type: 'admin_flag',
					userId: adminPlayer.id
				}
			});

			expect(adminNotifications).toHaveLength(1);

			const notification = adminNotifications[0];
			expect(notification.type).toBe('admin_flag');
			expect(notification.data).toEqual({
				flagId: expect.any(String),
				turnId: firstTurn.id,
				gameId: firstTurn.gameId,
				reason,
				explanation,
				flaggerUsername: players[1].username,
				turnCreatorUsername: players[0].username
			});
			expect(notification.actionUrl).toBe(`/g/${firstTurn.gameId}`);
			expect(notification.read).toBe(false);
		});

		it('should create admin notifications when a flag is made without explanation', async () => {
			// Player 2 joins the game
			const turn2 = await GameUseCases.createTurnAndMaybeGame(players[1].id);
			expect(turn2.gameId).toBe(firstTurn.gameId);

			// Player 2 flags the first turn without explanation
			const reason = 'offensive';
			const explanation = undefined;
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, reason);

			// Verify that admin notifications were created
			const adminNotifications = await prisma.notification.findMany({
				where: {
					type: 'admin_flag',
					userId: adminPlayer.id
				}
			});

			expect(adminNotifications).toHaveLength(1);

			const notification = adminNotifications[0];
			expect(notification.type).toBe('admin_flag');
			expect(notification.data).toEqual({
				flagId: expect.any(String),
				turnId: firstTurn.id,
				gameId: firstTurn.gameId,
				reason,
				explanation,
				flaggerUsername: players[1].username,
				turnCreatorUsername: players[0].username
			});
		});

		it('should create flagged player notification when a flag is confirmed', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			const flag = await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag');

			// Admin confirms the flag (rejecting the turn)
			await FlagUseCases.confirmFlag(flag.id, adminPlayer.id);

			// Verify that the flagged player (turn creator) notification was created
			const turnCreatorNotifications = await prisma.notification.findMany({
				where: {
					type: 'turn_rejected',
					userId: players[0].id
				}
			});

			expect(turnCreatorNotifications).toHaveLength(1);

			const notification = turnCreatorNotifications[0];
			expect(notification.type).toBe('turn_rejected');
			expect(notification.data).toEqual({
				flagId: flag.id,
				turnId: firstTurn.id,
				gameId: firstTurn.gameId,
				reason: 'spam',
				explanation: 'Test flag',
				adminUsername: adminPlayer.username
			});
			expect(notification.read).toBe(false);
		});

		it('should create flagger notification when a flag is rejected', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'offensive',
				'Not appropriate'
			);

			// Admin rejects the flag (allowing the turn)
			await FlagUseCases.rejectFlag(flag.id, adminPlayer.id);

			// Verify that the flagger notification was created
			const flaggerNotifications = await prisma.notification.findMany({
				where: {
					type: 'flag_rejected',
					userId: players[1].id
				}
			});

			expect(flaggerNotifications).toHaveLength(1);

			const notification = flaggerNotifications[0];
			expect(notification.type).toBe('flag_rejected');
			expect(notification.data).toEqual({
				flagId: flag.id,
				turnId: firstTurn.id,
				gameId: firstTurn.gameId,
				reason: 'offensive',
				adminUsername: adminPlayer.username
			});
			expect(notification.read).toBe(false);
		});

		it('should not create notifications when admin ID is not provided', async () => {
			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			const flag = await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam');

			// Count notifications before system resolution
			const notificationsBefore = await prisma.notification.count();

			// Resolve flag without admin ID (system resolution)
			await FlagUseCases.rejectFlag(flag.id);

			// Count notifications after system resolution
			const notificationsAfter = await prisma.notification.count();

			// Should not have created any additional notifications
			expect(notificationsAfter).toBe(notificationsBefore);
		});
	});

	describe('Game Completion Notifications', () => {
		it.skip('should create notifications for all participants when game is completed via turn completion', async () => {
			// Create a game with multiple players and complete it by reaching max turns
			const game = await GameUseCases.createGame({
				...testConfig,
				maxTurns: 3 // Set low max turns for easy completion
			});

			// Player 1 completes turn 1 (first turn is always writing)
			const turn1 = await GameUseCases.createTurn(players[0].id, game);
			expect(turn1.isDrawing).toBe(false); // First turn is writing
			await GameUseCases.completeTurn(turn1.id, 'writing', 'first turn');

			// Refetch game to get updated completedCount
			const updatedGame1 = await GameUseCases.findGameByIdAdmin(game.id);
			if (!updatedGame1) throw new Error('Game not found after turn 1');

			// Player 2 completes turn 2 (second turn is always drawing)
			const turn2 = await GameUseCases.createTurn(players[1].id, updatedGame1);
			expect(turn2.isDrawing).toBe(true); // Second turn is drawing
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'second.png');

			// Refetch game to get updated completedCount
			const updatedGame2 = await GameUseCases.findGameByIdAdmin(game.id);
			if (!updatedGame2) throw new Error('Game not found after turn 2');

			// Player 3 completes turn 3 (third turn is writing again)
			const turn3 = await GameUseCases.createTurn(players[2].id, updatedGame2);
			expect(turn3.isDrawing).toBe(false); // Third turn is writing
			await GameUseCases.completeTurn(turn3.id, 'writing', 'final turn');

			// Verify game completion notifications were created for all participants
			const notifications = await prisma.notification.findMany({
				where: {
					type: 'game_completion',
					data: {
						path: ['gameId'],
						equals: game.id
					}
				}
			});

			// Should have notifications for all 3 participants
			expect(notifications).toHaveLength(3);

			const notifiedPlayerIds = notifications.map((n) => n.userId).sort();
			const expectedPlayerIds = [players[0].id, players[1].id, players[2].id].sort();
			expect(notifiedPlayerIds).toEqual(expectedPlayerIds);

			// Verify notification structure
			notifications.forEach((notification) => {
				expect(notification.type).toBe('game_completion');
				expect(notification.data).toEqual({ gameId: game.id });
				expect(notification.actionUrl).toBe(`/g/${game.id}`);
				expect(notification.read).toBe(false);
			});
		});

		it.skip('should create notifications for all participants when game is manually completed', async () => {
			// Create a game with multiple players but don't reach max turns
			const game = await GameUseCases.createGame(testConfig);

			// Player 1 completes turn 1 (first turn is always writing)
			const turn1 = await GameUseCases.createTurn(players[0].id, game);
			expect(turn1.isDrawing).toBe(false); // First turn is writing
			await GameUseCases.completeTurn(turn1.id, 'writing', 'first turn');

			// Refetch game to get updated completedCount
			const updatedGame1 = await GameUseCases.findGameByIdAdmin(game.id);
			if (!updatedGame1) throw new Error('Game not found after turn 1');

			// Player 2 completes turn 2 (second turn is always drawing)
			const turn2 = await GameUseCases.createTurn(players[1].id, updatedGame1);
			expect(turn2.isDrawing).toBe(true); // Second turn is drawing
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'second.png');

			// Manually complete the game
			await GameUseCases.completeGame(game.id);

			// Verify game completion notifications were created for all participants
			const notifications = await prisma.notification.findMany({
				where: {
					type: 'game_completion',
					data: {
						path: ['gameId'],
						equals: game.id
					}
				}
			});

			// Should have notifications for both participants
			expect(notifications).toHaveLength(2);

			const notifiedPlayerIds = notifications.map((n) => n.userId).sort();
			const expectedPlayerIds = [players[0].id, players[1].id].sort();
			expect(notifiedPlayerIds).toEqual(expectedPlayerIds);

			// Verify notification structure
			notifications.forEach((notification) => {
				expect(notification.type).toBe('game_completion');
				expect(notification.data).toEqual({ gameId: game.id });
				expect(notification.actionUrl).toBe(`/g/${game.id}`);
				expect(notification.read).toBe(false);
			});
		});

		it.skip('should not create duplicate notifications if game completion is called multiple times', async () => {
			// Create a simple completed game
			const game = await GameUseCases.createGame({
				...testConfig,
				maxTurns: 2
			});

			// Player 1 completes turn 1 (first turn is always writing)
			const turn1 = await GameUseCases.createTurn(players[0].id, game);
			expect(turn1.isDrawing).toBe(false); // First turn is writing
			await GameUseCases.completeTurn(turn1.id, 'writing', 'first turn');

			// Refetch game to get updated completedCount
			const updatedGame1 = await GameUseCases.findGameByIdAdmin(game.id);
			if (!updatedGame1) throw new Error('Game not found after turn 1');

			// Player 2 completes turn 2 (second turn is always drawing)
			const turn2 = await GameUseCases.createTurn(players[1].id, updatedGame1);
			expect(turn2.isDrawing).toBe(true); // Second turn is drawing
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'second.png');

			// Try to complete again manually
			await GameUseCases.completeGame(game.id);

			// Should still only have 2 notifications (one per participant)
			const notifications = await prisma.notification.findMany({
				where: {
					type: 'game_completion',
					data: {
						path: ['gameId'],
						equals: game.id
					}
				}
			});

			expect(notifications).toHaveLength(2);
		});

		it('should handle games with no completed turns gracefully', async () => {
			// Create a game with no completed turns
			const game = await GameUseCases.createGame(testConfig);

			// Manually try to complete the game
			await GameUseCases.completeGame(game.id);

			// Should not create any notifications since no one participated
			const notifications = await prisma.notification.findMany({
				where: {
					type: 'game_completion',
					data: {
						path: ['gameId'],
						equals: game.id
					}
				}
			});

			expect(notifications).toHaveLength(0);
		});
	});

	describe('Dev Mode Email Handling', () => {
		afterEach(() => {
			vi.clearAllMocks();
		});

		it('should handle notification emails gracefully when user has no email in dev mode', async () => {
			// Mock Clerk to return a user without email addresses
			const mockUser: Partial<UserResource> = {
				id: players[0].id,
				emailAddresses: [] // No email addresses
			};
			mockGetUser.mockResolvedValue(mockUser as any);

			// Create a notification - this should not throw an error in dev mode
			await expect(
				createNotification({
					userId: players[0].id,
					type: 'test_notification',
					title: 'Test Notification',
					body: 'This is a test notification',
					templateData: {}
				})
			).resolves.not.toThrow();

			// Verify the notification was still created in the database
			const notifications = await prisma.notification.findMany({
				where: {
					userId: players[0].id,
					type: 'test_notification'
				}
			});

			expect(notifications).toHaveLength(1);
			expect(notifications[0].title).toBe('Test Notification');
		});

		it('should handle flag submitted notifications gracefully when admin has no email in dev mode', async () => {
			// Mock EmailService to simulate email sending failure
			const originalSendFlagSubmitted = EmailService.sendFlagSubmittedNotification;
			EmailService.sendFlagSubmittedNotification = vi
				.fn()
				.mockRejectedValue(new Error('No email address'));

			// Player 2 joins and flags the first turn - this should not throw in dev mode
			await GameUseCases.createTurnAndMaybeGame(players[1].id);

			await expect(
				FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test explanation')
			).resolves.not.toThrow();

			// Verify the flag was still created
			const flags = await prisma.turnFlag.findMany({
				where: {
					turnId: firstTurn.id,
					playerId: players[1].id
				}
			});

			expect(flags).toHaveLength(1);

			// Restore original method
			EmailService.sendFlagSubmittedNotification = originalSendFlagSubmitted;
		});

		it('should handle flag confirmed notifications gracefully when turn creator has no email in dev mode', async () => {
			// Mock Clerk to return users without email addresses
			const mockUser: Partial<UserResource> = {
				id: players[0].id,
				emailAddresses: [] // No email addresses
			};
			mockGetUser.mockResolvedValue(mockUser as any);

			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			const flag = await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test flag');

			// Admin confirms the flag - this should not throw in dev mode even if turn creator has no email
			await expect(FlagUseCases.confirmFlag(flag.id, adminPlayer.id)).resolves.not.toThrow();

			// Verify the flag was resolved
			const updatedFlag = await prisma.turnFlag.findUnique({
				where: { id: flag.id }
			});

			expect(updatedFlag?.resolvedAt).toBeTruthy();
		});

		it('should handle flag rejected notifications gracefully when flagger has no email in dev mode', async () => {
			// Mock Clerk to return users without email addresses
			const mockUser: Partial<UserResource> = {
				id: players[1].id,
				emailAddresses: [] // No email addresses
			};
			mockGetUser.mockResolvedValue(mockUser as any);

			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			const flag = await FlagUseCases.flagTurn(
				firstTurn.id,
				players[1].id,
				'offensive',
				'Not appropriate'
			);

			// Admin rejects the flag - this should not throw in dev mode even if flagger has no email
			await expect(FlagUseCases.rejectFlag(flag.id, adminPlayer.id)).resolves.not.toThrow();

			// Verify the flag was resolved
			const updatedFlag = await prisma.turnFlag.findUnique({
				where: { id: flag.id }
			});

			expect(updatedFlag?.resolvedAt).toBeTruthy();
		});
	});

	describe('Email Template Verification', () => {
		it('should verify admin flag notification template exists and renders correctly', async () => {
			// This test verifies that the email template system works for admin flag notifications
			// The actual email templates are tested in messaging.test.ts, but this ensures
			// the integration works end-to-end for the flag notification scenario

			// Player 2 joins and flags the first turn
			await GameUseCases.createTurnAndMaybeGame(players[1].id);
			await FlagUseCases.flagTurn(firstTurn.id, players[1].id, 'spam', 'Test explanation');

			// Verify admin notification was created with proper data structure
			const adminNotifications = await prisma.notification.findMany({
				where: {
					type: 'admin_flag',
					userId: adminPlayer.id
				}
			});

			expect(adminNotifications).toHaveLength(1);

			// The notification should have the expected data structure
			const notification = adminNotifications[0];
			expect(notification.data).toEqual({
				flagId: expect.any(String),
				turnId: firstTurn.id,
				gameId: firstTurn.gameId,
				reason: 'spam',
				explanation: 'Test explanation',
				flaggerUsername: players[1].username,
				turnCreatorUsername: players[0].username
			});
		});

		it.skip('should verify game completion notification template data', async () => {
			// Create and complete a simple game
			const game = await GameUseCases.createGame({
				...testConfig,
				maxTurns: 2
			});

			// Player 1 completes turn 1 (first turn is always writing)
			const turn1 = await GameUseCases.createTurn(players[0].id, game);
			expect(turn1.isDrawing).toBe(false); // First turn is writing
			await GameUseCases.completeTurn(turn1.id, 'writing', 'first turn');

			// Refetch game to get updated completedCount
			const updatedGame1 = await GameUseCases.findGameByIdAdmin(game.id);
			if (!updatedGame1) throw new Error('Game not found after turn 1');

			// Player 2 completes turn 2 (second turn is always drawing)
			const turn2 = await GameUseCases.createTurn(players[1].id, updatedGame1);
			expect(turn2.isDrawing).toBe(true); // Second turn is drawing
			await GameUseCases.completeTurn(turn2.id, 'drawing', 'second.png');

			// Verify game completion notifications have correct data structure
			const notifications = await prisma.notification.findMany({
				where: {
					type: 'game_completion',
					data: {
						path: ['gameId'],
						equals: game.id
					}
				}
			});

			expect(notifications).toHaveLength(2);

			notifications.forEach((notification) => {
				expect(notification.data).toEqual({ gameId: game.id });
			});
		});
	});
});
