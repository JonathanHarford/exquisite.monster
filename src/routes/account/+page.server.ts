import { updatePlayer } from '$lib/server/services/playerService';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod4 } from 'sveltekit-superforms/adapters';
import { playerProfileSchema } from '$lib/formSchemata';
import { error, fail } from '@sveltejs/kit';
import { uploadProfilePicture } from '$lib/server/storage';
import { logger } from '$lib/server/logger';
import { clerkClient } from 'svelte-clerk/server';
import { calculateAge } from '$lib/utils/hlc';
import { generateInvitationUrl } from '$lib/utils/invitation';
import { PUBLIC_BASE_URL } from '$env/static/public';
import { PartyUseCases } from '$lib/server/usecases/PartyUseCases';

export type SecurityEvent = {
	id: string;
	status: string;
	client?: string; // Optional, as it might not always be available/relevant
	ipAddress: string;
	userAgent: string;
	city: string;
	country: string;
	createdAt: string;
	updatedAt: string;
	lastActiveAt: string;
	expireAt: string;
};

export const load = (async ({ parent }) => {
	const { self } = await parent();
	if (!self) {
		throw error(401, 'Not authenticated');
	}

	// Pass the initial data directly to superValidate
	const form = await superValidate(
		{
			username: self.username || '',
			imageUrl: self.imageUrl || '',
			aboutMe: self.aboutMe || '',
			websiteUrl: self.websiteUrl || '',
			birthday: self.birthday ? self.birthday.toISOString().split('T')[0] : null,
			hideLewdContent: self.hideLewdContent ?? true
		},
		zod4(playerProfileSchema)
	);

	// Generate invitation URL
	const invitationUrl = generateInvitationUrl(PUBLIC_BASE_URL, self.id);

	// Get user's active parties
	const activeParties = await PartyUseCases.getUserActiveParties(self.id);

	return { form, self, invitationUrl, activeParties };
}) satisfies PageServerLoad;

export const actions = {
	syncPlayer: async ({ request, locals }) => {
		const formData = await request.formData();
		const username = formData.get('username') as string;
		const imageUrl = formData.get('imageUrl') as string;
		const player = await updatePlayer(locals.auth().userId!, { username, imageUrl });
		return { player };
	},

	uploadProfilePicture: async ({ request, locals }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('file') as File;

			if (!file || !file.size) {
				return fail(400, { error: 'No file provided' });
			}

			if (!locals.auth().userId) {
				return fail(401, { error: 'Not authenticated' });
			}

			const { path } = await uploadProfilePicture(file, locals.auth().userId);

			await updatePlayer(locals.auth().userId, { imageUrl: path });

			logger.info(`Profile picture uploaded for user ${locals.auth().userId}: ${path}`);

			try {
				await clerkClient.users.updateUserProfileImage(locals.auth().userId, {
					file: file
				});
				logger.info(`Profile picture synced with Clerk for user ${locals.auth().userId}`);
			} catch (clerkError) {
				// Log the error but don't fail the entire operation
				logger.error('Failed to sync profile picture with Clerk', clerkError, {
					userId: locals.auth().userId
				});
			}

			return { success: true, path };
		} catch (error) {
			logger.error('Profile picture upload failed', error, {
				userId: locals.auth().userId
			});

			return fail(500, {
				error: error instanceof Error ? error.message : 'Upload failed'
			});
		}
	},

	updateProfile: async ({ request, locals }) => {
		const form = await superValidate(request, zod4(playerProfileSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Ensure hideLewdContent is always true for users under 18 or without birthday
		const birthday = form.data.birthday;
		const isUnder18 = !birthday || calculateAge(birthday) < 18;
		if (isUnder18) {
			form.data.hideLewdContent = true;
		}

		await updatePlayer(userId, {
			username: form.data.username,
			imageUrl: form.data.imageUrl,
			aboutMe: form.data.aboutMe,
			websiteUrl: form.data.websiteUrl,
			birthday: birthday,
			hideLewdContent: form.data.hideLewdContent
		});

		// If we used Clerk usernames, we'd want to update them here.

		return message(form, 'Profile updated successfully');
	},
	loadSecurityEvents: async ({ locals }) => {
		if (!locals.auth().userId) {
			logger.error(
				'Attempt to load security events without authentication on /account/security page'
			);
			return fail(401, { error: 'Not authenticated' });
		}
		const userId = locals.auth().userId;
		logger.info(`Loading security events for user ${userId} on /account/security page`);

		try {
			const response = await clerkClient.sessions.getSessionList({
				userId: userId,
				limit: 25 // Fetch last 25 sessions
				// Default sort is newest first
			});

			const securityEvents: SecurityEvent[] = response.data.map((session) => ({
				id: session.id,
				status: session.status,
				client: session.clientId,
				ipAddress: session.latestActivity?.ipAddress || 'N/A',
				userAgent: session.latestActivity?.browserName
					? `${session.latestActivity.browserName} ${session.latestActivity.browserVersion || ''} on ${session.latestActivity.deviceType || 'Unknown Device'}`
					: 'N/A',
				city: session.latestActivity?.city || 'Unknown',
				country: session.latestActivity?.country || 'Unknown',
				createdAt: new Date(session.createdAt).toISOString(),
				updatedAt: new Date(session.updatedAt).toISOString(),
				lastActiveAt: new Date(session.lastActiveAt).toISOString(),
				expireAt: new Date(session.expireAt).toISOString()
			}));

			logger.info(
				`Successfully loaded ${securityEvents.length} security events for user ${userId} on /account/security page`
			);
			return { securityEvents };
		} catch (error) {
			logger.error('Failed to load security events from Clerk on /account/security page', error, {
				userId: userId
			});
			return fail(500, { error: 'Failed to load security events.' });
		}
	}
} satisfies Actions;
