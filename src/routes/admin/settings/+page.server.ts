import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod4 } from 'sveltekit-superforms/adapters';
import { dbToForm, gameConfigSchema, formToDb } from '$lib/formSchemata';
import { fetchDefaultGameConfig } from '$lib/server/services/configService';
import { logger } from '$lib/server/logger';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const player = locals.auth().userId
		? await prisma.player.findUnique({
				where: { id: locals.auth().userId },
				select: { isAdmin: true }
			})
		: null;

	if (!player?.isAdmin) {
		throw redirect(302, '/');
	}

	const config = await fetchDefaultGameConfig();
	const siteConfigForm = await superValidate(dbToForm(config), zod4(gameConfigSchema));

	return {
		siteConfigForm
	};
};

export const actions: Actions = {
	updateSiteConfig: async ({ request }) => {
		const form = await superValidate(request, zod4(gameConfigSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const configData = formToDb(form.data);
			await prisma.gameConfig.upsert({
				where: { id: 'default' },
				update: configData,
				create: { id: 'default', ...configData }
			});
			logger.info('Updated site config (default game config)', { configData });
			return message(form, 'Config updated');
		} catch (error) {
			logger.error('Failed to update site config:', error);
			return fail(500, {
				form,
				message: 'Failed to save configuration'
			});
		}
	}
};
