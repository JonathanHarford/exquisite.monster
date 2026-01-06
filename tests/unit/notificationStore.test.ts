import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationStore } from '$lib/stores/notifications.svelte';
import type { Notification } from '$lib/types/domain';

describe('NotificationStore', () => {
    let store: NotificationStore;

    const createTestNotification = (overrides: Partial<Notification> = {}): Notification => ({
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-id',
        type: 'info',
        title: 'Test Title',
        body: 'Test Body',
        read: false,
        data: null,
        actionUrl: null,
        ...overrides
    });

    beforeEach(() => {
        store = new NotificationStore();
    });

    it('should initialize with default values', () => {
        expect(store.notifications).toEqual([]);
        expect(store.unreadCount).toBe(0);
        expect(store.loading).toBe(false);
        expect(store.error).toBe(null);
        expect(store.connected).toBe(false);
    });

    it('should set notifications and update unreadCount', () => {
        const notifications: Notification[] = [
            createTestNotification({ id: '1', read: false }),
            createTestNotification({ id: '2', read: true }),
        ];

        store.setNotifications(notifications);

        expect(store.notifications).toEqual(notifications);
        expect(store.unreadCount).toBe(1);
    });

    it('should add a notification and update unreadCount', () => {
        const notification = createTestNotification({ id: '1', read: false });

        store.addNotification(notification);

        expect(store.notifications).toHaveLength(1);
        expect(store.notifications[0]).toEqual(notification);
        expect(store.unreadCount).toBe(1);
    });

    it('should mark all as read', () => {
        const notifications: Notification[] = [
            createTestNotification({ id: '1', read: false }),
            createTestNotification({ id: '2', read: false }),
        ];
        store.setNotifications(notifications);

        store.markAllAsRead();

        expect(store.unreadCount).toBe(0);
        expect(store.notifications.every(n => n.read)).toBe(true);
    });

    it('should mark a single notification as read', () => {
        const notifications: Notification[] = [
            createTestNotification({ id: '1', read: false }),
            createTestNotification({ id: '2', read: false }),
        ];
        store.setNotifications(notifications);

        store.markAsRead('1');

        expect(store.unreadCount).toBe(1);
        expect(store.notifications.find(n => n.id === '1')?.read).toBe(true);
        expect(store.notifications.find(n => n.id === '2')?.read).toBe(false);
    });

    it('should not decrement unreadCount if notification was already read', () => {
        const notifications: Notification[] = [
            createTestNotification({ id: '1', read: true }),
        ];
        store.setNotifications(notifications);
        expect(store.unreadCount).toBe(0);

        store.markAsRead('1');
        expect(store.unreadCount).toBe(0);
    });

    it('should handle loading state', () => {
        store.setLoading(true);
        expect(store.loading).toBe(true);
    });

    it('should handle error state', () => {
        store.setError('Something went wrong');
        expect(store.error).toBe('Something went wrong');

        store.clearError();
        expect(store.error).toBe(null);
    });

    it('should reset the store', () => {
        store.notifications = [createTestNotification({ id: '1', read: false })];
        store.unreadCount = 5; // Simulating out of sync or just testing reset
        store.error = 'Error';
        store.connected = true;
        store.loading = true;

        store.reset();

        expect(store.notifications).toEqual([]);
        expect(store.unreadCount).toBe(0);
        expect(store.error).toBe(null);
        expect(store.connected).toBe(false);
        expect(store.loading).toBe(false);
    });
});
