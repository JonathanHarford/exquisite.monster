import {
	getNotifications,
	markAllAsRead,
	markAsRead
} from '$lib/server/services/notificationService';
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { markAllAsReadSchema, markAsReadSchema } from '$lib/formSchemata';

export const load = (async ({ locals, url }) => {
	// Ensure user is authenticated (inherited from account layout)
	const userId = locals.auth().userId!;

	if (!userId) {
		error(401, 'Unauthorized');
	}

	// Get pagination parameters from URL
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const unreadOnly = url.searchParams.get('unread') === 'true';

	// Fetch notifications for the user
	const notifications = await getNotifications(userId, {
		page,
		limit,
		unreadOnly
	});

	// Initialize forms for Superforms
	const markAllAsReadForm = await superValidate(zod4(markAllAsReadSchema));
	const markAsReadForm = await superValidate(zod4(markAsReadSchema));

	return {
		notifications,
		pagination: {
			page,
			limit,
			unreadOnly
		},
		markAllAsReadForm,
		markAsReadForm
	};
}) satisfies PageServerLoad;

export const actions = {
	markAllAsRead: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(markAllAsReadSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const count = await markAllAsRead(locals.auth().userId!);
			return { form, success: true, count };
		} catch (error) {
			console.error('Error marking all notifications as read:', error);
			return fail(500, { form, error: 'Failed to mark all notifications as read' });
		}
	},

	markAsRead: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(markAsReadSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const wasUpdated = await markAsRead(locals.auth().userId!, form.data.notificationId);
			return { form, success: true, wasUpdated };
		} catch (error) {
			console.error('Error marking notification as read:', error);
			return fail(500, { form, error: 'Failed to mark notification as read' });
		}
	}
} satisfies Actions;
