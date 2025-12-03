import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

// Sentry tunnel to bypass CORS issues
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Only accept requests with the proper content-type
		const contentType = request.headers.get('content-type');
		if (contentType !== 'application/x-sentry-envelope') {
			return new Response(null, { status: 415 }); // Unsupported Media Type
		}

		// Validate the request came from our own domain or is a legitimate Sentry client
		const origin = request.headers.get('origin');
		const referer = request.headers.get('referer');
		const userAgent = request.headers.get('user-agent');

		// Block obvious bots and health checkers
		if (userAgent && (
			userAgent.includes('bot') ||
			userAgent.includes('crawler') ||
			userAgent.includes('spider') ||
			userAgent.includes('curl') ||
			userAgent.includes('wget') ||
			userAgent.toLowerCase().includes('health')
		)) {
			return new Response(null, { status: 403 });
		}

		// Require either origin or referer to be from our domain or be a browser
		const validOrigin = origin && (
			origin.includes('epicgame.fun') ||
			origin.includes('localhost') ||
			origin.includes('127.0.0.1')
		);
		const validReferer = referer && (
			referer.includes('epicgame.fun') ||
			referer.includes('localhost') ||
			referer.includes('127.0.0.1')
		);

		if (!validOrigin && !validReferer) {
			// Silently reject without logging to avoid spam
			return new Response(null, { status: 403 });
		}

		const envelope = await request.text();

		// Validate envelope is not empty
		if (!envelope || envelope.trim().length === 0) {
			console.warn('Sentry tunnel: Empty request body');
			return new Response(null, { status: 400 });
		}

		const pieces = envelope.split('\n');

		// Validate we have at least a header line
		if (!pieces[0] || pieces[0].trim().length === 0) {
			console.warn('Sentry tunnel: Missing envelope header');
			return new Response(null, { status: 400 });
		}

		// Parse header with error handling
		let header;
		try {
			header = JSON.parse(pieces[0]);
		} catch (parseError) {
			console.warn('Sentry tunnel: Invalid JSON in envelope header', parseError);
			return new Response(null, { status: 400 });
		}

		if (!header.dsn) {
			throw new Error('No DSN found in envelope header');
		}

		// Extract DSN components
		const dsnMatch = header.dsn.match(/https:\/\/(.+)@(.+)\/(.+)/);
		if (!dsnMatch) {
			throw new Error('Invalid DSN format');
		}

		const [, key, host, projectId] = dsnMatch;
		const sentryUrl = `https://${host}/api/${projectId}/envelope/`;

		// Forward to Sentry
		const response = await fetch(sentryUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-sentry-envelope',
				'X-Sentry-Auth': `Sentry sentry_version=7,sentry_key=${key},sentry_client=sentry.javascript.sveltekit`
			},
			body: envelope
		});

		return new Response(null, { status: response.status });
	} catch (error) {
		// Silently fail to prevent breaking the app
		console.warn('Sentry tunnel error:', error);
		return new Response(null, { status: 200 });
	}
};
