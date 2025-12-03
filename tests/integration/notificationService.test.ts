import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '$lib/server/prisma';
import {
	createNotification,
	markAsRead,
	getNotifications
} from '$lib/server/services/notificationService';
import { toDomainNotification } from '$lib/types/domain';

// NOTE: Global mocks for Sentry, Clerk, etc. are handled in setup.ts

describe('NotificationService', () => {
	const testUserId = 'test-user-notifications';
    const otherUserId = 'other-test-user';

	beforeEach(async () => {
        // Create test users
        await prisma.player.upsert({
            where: { id: testUserId },
            update: {},
            create: {
                id: testUserId,
                username: 'testuser',
                imageUrl: 'test.png',
                isAdmin: false
            }
        });
        
        await prisma.player.upsert({
            where: { id: otherUserId },
            update: {},
            create: {
                id: otherUserId,
                username: 'otheruser',
                imageUrl: 'other.png',
                isAdmin: false
            }
        });

        // Clear notifications
        await prisma.notification.deleteMany({
            where: { userId: { in: [testUserId, otherUserId] } }
        });
	});

    afterEach(async () => {
        await prisma.notification.deleteMany({
            where: { userId: { in: [testUserId, otherUserId] } }
        });
        await prisma.player.deleteMany({
            where: { id: { in: [testUserId, otherUserId] } }
        });
    });

	describe('markAsRead', () => {
		it('should mark an unread notification as read', async () => {
            // Create a notification first
            const notification = await prisma.notification.create({
                data: {
                    userId: testUserId,
                    type: 'test',
                    title: 'Test',
                    body: 'Test body',
                    read: false
                }
            });

			// Mark it as read
			const wasUpdated = await markAsRead(testUserId, notification.id);

			expect(wasUpdated).toBe(true);

            // Verify in DB
            const updated = await prisma.notification.findUnique({
                where: { id: notification.id }
            });
            expect(updated?.read).toBe(true);
		});

		it('should return false when trying to mark an already read notification', async () => {
            // Create a read notification
            const notification = await prisma.notification.create({
                data: {
                    userId: testUserId,
                    type: 'test',
                    title: 'Test',
                    body: 'Test body',
                    read: true
                }
            });

			const wasUpdated = await markAsRead(testUserId, notification.id);

			expect(wasUpdated).toBe(false);
		});

		it('should return false when trying to mark another users notification', async () => {
            // Create notification for other user
            const notification = await prisma.notification.create({
                data: {
                    userId: otherUserId,
                    type: 'test',
                    title: 'Test',
                    body: 'Test body',
                    read: false
                }
            });

            const wasUpdated = await markAsRead(testUserId, notification.id);

            expect(wasUpdated).toBe(false);
            
            // Verify it wasn't changed
            const notif = await prisma.notification.findUnique({
                where: { id: notification.id }
            });
            expect(notif?.read).toBe(false);
		});

		it('should return false for non-existent notification', async () => {
			const wasUpdated = await markAsRead(testUserId, 'non-existent-id');
			expect(wasUpdated).toBe(false);
		});
	});

	describe('integration with other functions', () => {
		it('should work correctly with getNotifications', async () => {
            // Create notifications
            await prisma.notification.create({
                data: {
                    userId: testUserId,
                    type: 'test',
                    title: 'Notification 1',
                    body: 'First notification',
                    read: false,
                    createdAt: new Date(Date.now() - 1000) // Older
                }
            });
            
            await prisma.notification.create({
                data: {
                    userId: testUserId,
                    type: 'test',
                    title: 'Notification 2',
                    body: 'Second notification',
                    read: true,
                    createdAt: new Date() // Newer
                }
            });

			// Get all notifications
			const allNotifications = await getNotifications(testUserId);
			expect(allNotifications).toHaveLength(2);
            // Should be ordered by createdAt desc (newest first)
            expect(allNotifications[0].title).toBe('Notification 2');
            expect(allNotifications[1].title).toBe('Notification 1');

			// Get only unread notifications
			const unreadNotifications = await getNotifications(testUserId, { unreadOnly: true });
			expect(unreadNotifications).toHaveLength(1);
			expect(unreadNotifications[0].title).toBe('Notification 1');
		});
	});

    describe('createNotification', () => {
        it('should create a notification and return domain object', async () => {
            const input = {
                userId: testUserId,
                type: 'test',
                title: 'Test Notification',
                body: 'This is a test notification',
                actionUrl: '/test'
            };

            const result = await createNotification(input);

            expect(result.id).toBeDefined();
            expect(result.title).toBe(input.title);
            expect(result.body).toBe(input.body);
            expect(result.read).toBe(false);
            
            // Verify in DB
            const dbNotif = await prisma.notification.findUnique({
                where: { id: result.id }
            });
            expect(dbNotif).toBeDefined();
            expect(dbNotif?.userId).toBe(testUserId);
        });

        it('should create an invitation_accepted notification', async () => {
            const input = {
                userId: testUserId,
                type: 'invitation_accepted',
                templateData: {
                    inviteeUsername: 'otheruser',
                    inviteeId: otherUserId
                },
                actionUrl: `/p/${otherUserId}`
            };

            const result = await createNotification(input);

            expect(result.id).toBeDefined();
            expect(result.type).toBe('invitation_accepted');
            expect(result.read).toBe(false);

            // Verify in DB
            const dbNotif = await prisma.notification.findUnique({
                where: { id: result.id }
            });
            expect(dbNotif).toBeDefined();
            expect(dbNotif?.userId).toBe(testUserId);

            // Note: We don't verify title/body content strictly because it relies on
            // templates which might not be seeded in the test environment for this type,
            // or would be fallback values.
        });
    });
});
