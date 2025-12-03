import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [sveltekit()],
		resolve: {
			conditions: ['browser']
		},
		test: {
			name: 'integration',
			globals: true,
			environment: 'jsdom',
			include: ['tests/integration/**/*.test.ts'],
			setupFiles: ['./tests/unit/url-polyfill.ts', './tests/integration/setup.ts'],
			pool: 'threads',
			poolOptions: {
				threads: {
					singleThread: true, // Force sequential execution to prevent database race conditions
					maxThreads: 1,
					minThreads: 1
				}
			},
			env: {
				NODE_ENV: 'test',
				PUBLIC_ENVIRONMENT: 'test',
				// Use test database for integration tests
				DATABASE_URL: env.DATABASE_URL_TEST,
				POSTGRES_URL_NON_POOLING: env.DATABASE_URL_TEST,
				EMAIL_PROVIDER: 'inbucket',
				ADMIN_EMAIL: env.ADMIN_EMAIL || '',
				FROM_EMAIL: env.FROM_EMAIL || '',
				PUBLIC_BASE_URL: env.PUBLIC_BASE_URL || 'http://localhost:3793',
				PUBLIC_CLERK_PUBLISHABLE_KEY:
					env.PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dummy_key_for_tests',
				CLERK_SECRET_KEY: env.CLERK_SECRET_KEY || 'sk_test_dummy_key_for_tests'
			},
			testTimeout: 8000, // Longer timeout for database operations
			hookTimeout: 30000, // Long timeout for database setup/teardown
			isolate: false,
			silent: false,
			reporters: [
				[
					'default',
					{
						summary: true,
						verbose: false
					}
				]
			],
			sequence: {
				concurrent: false // Disable concurrent execution to prevent database conflicts
			},
			logHeapUsage: false,
			passWithNoTests: true,
			coverage: {
				enabled: false
			}
		}
	};
});
