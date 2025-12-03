import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Enforce admin access for all admin routes
	await locals.security.isAdmin();

	// If we get here, the user is authenticated and is an admin
	return {};
};
