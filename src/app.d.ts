import type { UserResource } from '@clerk/types';
import type { AuthObject } from 'svelte-clerk/server';
import type { Security } from '$lib/security';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="svelte-clerk/env" />

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: () => AuthObject & { userId: string }; // WORKAROUND:Why does it think AuthObject doesn't have userId?
			security: Security;
		}
		interface Error {
			// message: string; // Implied
			body?: unknown;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

declare global {
	interface DocumentEventMap {
		'clerk-sveltekit:user': CustomEvent<UserResource>;
	}
}
