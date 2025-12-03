import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { contactFormSchema } from '$lib/formSchemata';
import { createNotification } from '$lib/server/services/notificationService';
import { prisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	locals.security.isAuthenticated();
	const form = await superValidate(zod4(contactFormSchema));
	return { form };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod4(contactFormSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { name, email, subject, message: contactMessage } = form.data;

		try {
			// Get all admin users
			const adminUsers = await prisma.player.findMany({
				where: { isAdmin: true },
				select: { id: true }
			});

			if (adminUsers.length === 0) {
				logger.warn('No admin users found to send contact form notification');
				return message(form, 'Your message has been received. We will get back to you soon!');
			}

			// Create notifications for all admins
			const notificationPromises = adminUsers.map((admin) =>
				createNotification({
					userId: admin.id,
					type: 'contact_form',
					data: {
						senderName: name,
						senderEmail: email,
						subject,
						message: contactMessage,
						submittedAt: new Date().toISOString()
					},
					actionUrl: '/admin', // Link to admin dashboard
					templateData: {
						senderName: name,
						senderEmail: email,
						subject,
						message: contactMessage
					}
				})
			);

			await Promise.all(notificationPromises);

			logger.info(
				`Contact form submitted by ${name} (${email}), notifications sent to ${adminUsers.length} admins`
			);

			return message(
				form,
				'Thank you for your message! We have received your contact form and will get back to you soon.'
			);
		} catch (error) {
			logger.error('Failed to process contact form:', error);
			return fail(500, {
				form,
				error: 'There was an error processing your message. Please try again later.'
			});
		}
	}
};
