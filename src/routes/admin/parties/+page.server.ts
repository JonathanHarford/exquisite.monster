import { redirect } from '@sveltejs/kit';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { prisma } from '$lib/server/prisma';
import type { PageServerLoad } from './$types';

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

	const partyList = await AdminUseCases.getPartyList();

	return {
		partyList
	};
};
