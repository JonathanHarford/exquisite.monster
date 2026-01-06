import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';
import { type Handle, type HandleServerError } from '@sveltejs/kit';
import { Security } from '$lib/security';
import { logger } from '$lib/server/logger';
import { initializeServerServices, areServerServicesInitialized } from '$lib/server/startup.js';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

// Only initialize Sentry if DSN is provided
// Note: Sentry DSN must be public because the client needs it too
if (env.PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: env.PUBLIC_SENTRY_DSN,
		enabled: !dev,
		tracesSampleRate: 1,
		enableLogs: true
	});
}

const securityMiddleware: Handle = async ({ event, resolve }) => {
	event.locals.security = new Security(event);
	return resolve(event);
};

const startupMiddleware: Handle = async ({ event, resolve }) => {
	if (!areServerServicesInitialized()) {
		try {
			// Wait for initialization to complete before processing requests
			await initializeServerServices();
		} catch (error) {
			logger.error('Server service initialization failed:', error);
			// Continue processing - some services may still work
		}
	}
	return resolve(event);
};

// const cacheMiddleware: Handle = async ({ event, resolve }) => {
// 	// Check for conditional requests first (304 Not Modified)
// 	const conditionalResponse = handleConditionalRequest(event);
// 	if (conditionalResponse) {
// 		return conditionalResponse;
// 	}

// 	// Get the response from the next handler
// 	const response = await resolve(event);

// 	// Apply cache headers based on the request
// 	const cacheConfig = getCacheConfigForRequest(event);
// 	if (cacheConfig) {
// 		return applyCacheHeaders(response, cacheConfig, event);
// 	}

// 	return response;
// };

// Combine Clerk handler with our auth middleware
export const handle = sequence(
	Sentry.sentryHandle(),
	withClerkHandler({
		debug: false
	}),
	startupMiddleware,
	securityMiddleware,
	// cacheMiddleware,
	({ event, resolve }) => {
		if (event.url.pathname.startsWith('/.well-known/appspecific/com.chrome.devtools')) {
			return new Response(null, { status: 204 });
		}
		return resolve(event, {
			filterSerializedResponseHeaders: (name) => name === 'content-type'
		});
	}
);

export const handleError = Sentry.handleErrorWithSentry((({ error, event }) => {
	const errorId = crypto.randomUUID();

	// ALWAYS log error on server with full context - logger handles dev/prod formatting internally
	logger.error('🚨 Server Error Occurred', error, {
		errorId,
		path: event.url.pathname,
		method: event.request.method,
		userAgent: event.request.headers.get('user-agent'),
		userId: event.locals.auth?.().userId
	});

	// NEVER expose internal error details to frontend, even in development
	// Frontend should only get user-safe messages
	return {
		message: 'An unexpected error occurred',
		errorId
	};
}) satisfies HandleServerError);
