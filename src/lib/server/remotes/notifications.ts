import {
	getNotifications as fetchNotifications,
	markAsRead as markAsReadService
} from '$lib/server/services/notificationService';
import type { RequestEvent } from '@sveltejs/kit';

export async function getNotificationsLogic(event: RequestEvent) {
	const userId = event.locals.auth().userId;

	if (!userId) {
		throw new Error('Unauthorized');
	}

	try {
		return await fetchNotifications(userId, { unreadOnly: true });
	} catch (err) {
		console.error('Error fetching notifications:', err);
		throw new Error('Failed to fetch notifications');
	}
}

export async function markAsReadLogic(event: RequestEvent, notificationId: string) {
	const userId = event.locals.auth().userId;

	if (!userId) {
		throw new Error('Unauthorized');
	}

	try {
		return await markAsReadService(userId, notificationId);
	} catch (err) {
		console.error('Error marking notification as read:', err);
		throw new Error('Failed to mark notification as read');
	}
}
