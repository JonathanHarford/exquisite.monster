import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
// import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig(({ mode }) => {
	// Load env file based on `mode` in the current working directory.
	// Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
	const env = loadEnv(mode, process.cwd(), '');

	// Only enable Sentry plugin if DSN is configured
	const plugins = [
		...(env.PUBLIC_SENTRY_DSN ? [sentrySvelteKit()] : []),
		sveltekit()
		// SvelteKitPWA({
		// 	strategies: 'generateSW',
		// 	scope: '/',
		// 	base: '/',
		// 	workbox: {
		// 		globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
		// 		globIgnores: [
		// 			'**/node_modules/**/*',
		// 			'prerendered/**/*' // Ignore prerendered files if they don't exist
		// 		]
		// 	}
		// })
	];

	return {
		plugins,

		// Set cache directory for Vite (Vitest will use cacheDir/vitest)
		cacheDir: 'node_modules/.vite',

		// Optimize dependency handling
		optimizeDeps: {
			exclude: ['fsevents']
		},

		// Suppress specific warnings
		build: {
			rollupOptions: {
				external: ['node:dns/promises'] // Suppress browser compatibility warning
			}
		},

		server: {
			port: 3792
		},

		test: {
			globals: true, // Ensures Vitest global functions are available
			environment: 'jsdom', // Crucial for client-side component testing
			include: ['tests/unit/**/*.test.ts'],
			setupFiles: ['./tests/unit/url-polyfill.ts', './tests/unit/setup.ts'], // URL polyfill must run first
			pool: 'threads',
			poolOptions: {
				threads: {
					singleThread: true, // Force sequential execution to prevent race conditions
					maxThreads: 1,
					minThreads: 1
				}
			},
			// Set environment variables for tests
			env: {
				NODE_ENV: 'test',
				PUBLIC_ENVIRONMENT: 'test',
				DATABASE_URL: env.DATABASE_URL_TEST,
				POSTGRES_URL_NON_POOLING: env.DATABASE_URL_TEST,
				EMAIL_PROVIDER: 'inbucket',

				ADMIN_EMAIL: env.ADMIN_EMAIL || '',
				FROM_EMAIL: env.FROM_EMAIL || '',
				PUBLIC_BASE_URL: env.PUBLIC_BASE_URL || 'http://localhost:3793',

				// Clerk environment variables for tests
				PUBLIC_CLERK_PUBLISHABLE_KEY:
					env.PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dummy_key_for_tests',
				CLERK_SECRET_KEY: env.CLERK_SECRET_KEY || 'sk_test_dummy_key_for_tests'
			},
			// Optimized timeouts for faster feedback
			testTimeout: 8000, // Reduced from 10000
			hookTimeout: 15000, // Reduced from 20000
			// Performance optimizations
			isolate: false,
			// Reduce logging overhead with optimized reporter
			silent: false,
			reporters: [
				[
					'default',
					{
						summary: false, // Disable summary for faster output
						verbose: false // Reduce verbosity
					}
				]
			],
			// Disable concurrent execution to prevent database conflicts
			sequence: {
				concurrent: false
			},
			// Additional performance optimizations
			logHeapUsage: false,
			passWithNoTests: true,
			// Note: Cache directory is now configured at the Vite level (cacheDir)
			// Reduce output verbosity
			outputFile: undefined, // Don't write output files during tests
			// Optimize coverage collection (disable for performance)
			coverage: {
				enabled: false
			}
		}
	};
});
