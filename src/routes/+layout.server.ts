import { buildClerkProps } from 'svelte-clerk/server';
import type { LayoutServerLoad } from './$types';
import { SessionService } from '$lib/server/services/sessionService';
import { InvitationService } from '$lib/server/services/invitationService';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, depends, url, cookies, request }) => {
	depends('self');
	depends('invitation');
	const auth = locals.auth();

	// Handle invitation parameter (URL -> Cookie -> Redirect)
	InvitationService.handleInvitationParam(url, cookies);

	// Process stored invitation (Cookie -> DB -> Info/Redirect)
	const { inviterInfo, redirectUrl } = await InvitationService.processStoredInvitation(cookies, auth);

	if (redirectUrl) {
		throw redirect(302, redirectUrl);
	}

	const sessionData = await SessionService.loadSession({
		auth,
		url,
		cookies,
		request
	});

	return {
		...buildClerkProps(auth),
		...sessionData,
		inviterInfo
	};
};
