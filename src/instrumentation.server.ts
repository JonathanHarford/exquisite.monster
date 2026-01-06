import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/environment';

// Initialize OpenTelemetry instrumentation with Sentry
// This file runs before the application starts, allowing early setup of tracing infrastructure
if (process.env.PUBLIC_SENTRY_DSN && !dev) {
	Sentry.init({
		dsn: process.env.PUBLIC_SENTRY_DSN,
		tracesSampleRate: 1.0,

		// Enable OpenTelemetry integrations for automatic instrumentation
		integrations: [
			// Automatically trace Prisma database queries
			Sentry.prismaIntegration(),
			// Automatically trace Redis/BullMQ operations
			Sentry.redisIntegration()
		]
	});
}
