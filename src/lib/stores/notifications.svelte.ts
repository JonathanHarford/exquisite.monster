import type { Notification } from '$lib/types/domain';
import { appState } from '$lib/appstate.svelte';

export const notificationActions = {
	setNotifications: (notifications: Notification[]) => {
		appState.notificationStore.notifications = notifications;
		appState.notificationStore.unreadCount = notifications.filter((n) => !n.read).length;
	},

	addNotification: (notification: Notification) => {
		appState.notificationStore.notifications.unshift(notification);
		if (!notification.read) {
			appState.notificationStore.unreadCount++;
		}
	},

	markAllAsRead: () => {
		appState.notificationStore.notifications = appState.notificationStore.notifications.map(
			(notification) => ({
				...notification,
				read: true
			})
		);
		appState.notificationStore.unreadCount = 0;
	},

	markAsRead: (notificationId: string) => {
		appState.notificationStore.notifications = appState.notificationStore.notifications.map(
			(notification) => {
				if (notification.id === notificationId && !notification.read) {
					appState.notificationStore.unreadCount = Math.max(
						0,
						appState.notificationStore.unreadCount - 1
					);
					return { ...notification, read: true };
				}
				return notification;
			}
		);
	},

	setLoading: (loading: boolean) => {
		appState.notificationStore.loading = loading;
	},

	setError: (error: string | null) => {
		appState.notificationStore.error = error;
	},

	clearError: () => {
		appState.notificationStore.error = null;
	}
};
