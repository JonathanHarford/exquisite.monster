import { getNotificationsLogic, markAsReadLogic } from '$lib/server/remotes/notifications';
import { query, command, getRequestEvent } from '$app/server';

/**
 * Get notifications for the current user
 */
export const getNotifications = query(async () => {
	const event = getRequestEvent();
	return getNotificationsLogic(event);
});

/**
 * Mark a notification as read
 */
export const markAsRead = command('unchecked', async (notificationId: string) => {
	const event = getRequestEvent();
	return markAsReadLogic(event, notificationId);
});
