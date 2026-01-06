import type { Notification } from '$lib/types/domain';

export class NotificationStore {
	notifications = $state<Notification[]>([]);
	unreadCount = $state(0);
	loading = $state(false);
	error = $state<string | null>(null);
	connected = $state(false);

	setNotifications(notifications: Notification[]) {
		this.notifications = notifications;
		this.unreadCount = notifications.filter((n) => !n.read).length;
	}

	addNotification(notification: Notification) {
		this.notifications.unshift(notification);
		if (!notification.read) {
			this.unreadCount++;
		}
	}

	markAllAsRead() {
		this.notifications = this.notifications.map((notification) => ({
			...notification,
			read: true
		}));
		this.unreadCount = 0;
	}

	markAsRead(notificationId: string) {
		let changed = false;
		this.notifications = this.notifications.map((notification) => {
			if (notification.id === notificationId && !notification.read) {
				changed = true;
				return { ...notification, read: true };
			}
			return notification;
		});

		if (changed) {
			this.unreadCount = Math.max(0, this.unreadCount - 1);
		}
	}

	setLoading(loading: boolean) {
		this.loading = loading;
	}

	setError(error: string | null) {
		this.error = error;
	}

	clearError() {
		this.error = null;
	}

	reset() {
		this.notifications = [];
		this.unreadCount = 0;
		this.error = null;
		this.connected = false;
		this.loading = false;
	}
}
