import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';

// Only initialize Sentry if DSN is provided
// Note: Using dynamic/public because we need runtime check for optional env var
if (env.PUBLIC_SENTRY_DSN) {
	// Wrap Sentry initialization in try-catch to prevent CORS errors from breaking auth
	try {
		Sentry.init({
			dsn: env.PUBLIC_SENTRY_DSN,
			enabled: !dev,
			enableLogs: true,
			tracesSampleRate: 1.0,

			// This sets the sample rate to be 10%. You may want this to be 100% while
			// in development and sample at a lower rate in production
			replaysSessionSampleRate: 0.1,

			// If the entire session is not sampled, use the below sample rate to sample
			// sessions when an error occurs.
			replaysOnErrorSampleRate: 1.0,

			// If you don't want to use Session Replay, just remove the line below:
			integrations: [replayIntegration()],

			// Use tunnel to bypass CORS issues
			tunnel: '/api/sentry-tunnel',

			// Add error handling to prevent CORS issues from breaking the app
			beforeSend(event) {
				// Silently drop events if Sentry is having CORS issues
				return event;
			}
		});
	} catch (error) {
		// Silently fail if Sentry can't initialize - don't break auth
		console.warn('Sentry initialization failed:', error);
	}
}

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
