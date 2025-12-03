import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { AuthObject } from 'svelte-clerk/server';
import { logger } from '$lib/server/logger';
import { findPlayerById } from '$lib/server/services/playerService';

export class Security {
	private readonly auth?: AuthObject & { userId: string };

	constructor(private readonly event: RequestEvent) {
		this.auth = event.locals.auth();
	}

	isPublic() {
		if (this.auth?.userId) {
			logger.info('redirecting to profile', { userId: this.auth?.userId });
			redirect(307, '/profile');
		}
		return this;
	}

	isAuthenticated() {
		if (!this.auth?.userId) {
			logger.info('redirecting to home', { userId: this.auth?.userId });
			redirect(302, '/');
		}
		return this;
	}

	hasPermission(permission: string) {
		const permitted = this.auth?.has({ permission });
		if (!permitted) {
			error(403, 'missing permission: ' + permission);
		}
		return this;
	}

	async isAdmin() {
		if (!this.auth?.userId) {
			logger.info('Admin access denied: not authenticated', { url: this.event.url.pathname });
			redirect(302, '/');
		}

		try {
			const player = await findPlayerById(this.auth.userId);
			if (!player?.isAdmin) {
				logger.info('Admin access denied: user is not admin', {
					userId: this.auth.userId,
					url: this.event.url.pathname
				});
				redirect(302, '/');
			}
		} catch (error) {
			logger.error('Admin access check failed', {
				userId: this.auth.userId,
				url: this.event.url.pathname,
				error
			});
			redirect(302, '/');
		}

		return this;
	}
}
