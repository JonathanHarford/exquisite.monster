import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotification } from '$lib/server/services/notificationService';
import { queueGeneralNotification } from '$lib/server/queues/emailQueue';

// Mock prisma
vi.mock('$lib/server/prisma', () => ({
    prisma: {
        notification: {
            create: vi.fn(),
        },
        player: {
            findUnique: vi.fn(),
        }
    }
}));

// Mock messaging
vi.mock('$lib/server/messaging', () => ({
    getMessageTemplate: vi.fn().mockResolvedValue({
        title: 'Template Title',
        body: 'Template Body',
        subject: 'Email Subject',
        htmlBody: '<p>Email Body</p>'
    }),
    MessageData: {}
}));

// Mock Redis - overriding setup mock just to be safe or rely on setup?
// Setup mock doesn't include 'publish'. We need publish for createNotification.
vi.mock('$lib/server/redis', () => ({
    redis: {
        publish: vi.fn()
    }
}));

import { prisma } from '$lib/server/prisma';

describe('notificationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should queue email notification when creating notification', async () => {
        const mockNotification = {
            id: 'notif-123',
            userId: 'user-123',
            type: 'test-type',
            title: 'Test Title',
            body: 'Test Body',
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        (prisma.notification.create as any).mockResolvedValue(mockNotification);

        await createNotification({
            userId: 'user-123',
            type: 'test-type',
            title: 'Test Title',
            body: 'Test Body'
        });

        expect(queueGeneralNotification).toHaveBeenCalledWith(expect.objectContaining({
            notificationId: 'notif-123',
            userId: 'user-123',
            notificationType: 'test-type'
        }));
    });
});
