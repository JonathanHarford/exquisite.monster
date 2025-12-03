import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNotifications } from '$lib/server/services/notificationService';

export const GET: RequestHandler = async ({ locals }) => {
	// Use Clerk's built-in authentication from locals
	const userId = locals.auth().userId;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Pass userId directly
		const notifications = await getNotifications(userId, { unreadOnly: true });
		return json(notifications);
	} catch (err) {
		console.error('Error fetching notifications:', err);
		throw error(500, 'Failed to fetch notifications');
	}
};
