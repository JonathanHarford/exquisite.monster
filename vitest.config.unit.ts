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
			name: 'unit',
			globals: true,
			environment: 'jsdom',
			include: ['tests/unit/**/*.test.ts'],
			setupFiles: ['./tests/unit/url-polyfill.ts', './tests/unit/setup.ts'],
			pool: 'threads',
			poolOptions: {
				threads: {
					singleThread: false, // Unit tests can run in parallel
					maxThreads: 4,
					minThreads: 1
				}
			},
			env: {
				NODE_ENV: 'test',
				PUBLIC_ENVIRONMENT: 'test',
				EMAIL_PROVIDER: 'inbucket',
				ADMIN_EMAIL: env.ADMIN_EMAIL || '',
				FROM_EMAIL: env.FROM_EMAIL || '',
				PUBLIC_BASE_URL: env.PUBLIC_BASE_URL || 'http://localhost:3793',
				PUBLIC_CLERK_PUBLISHABLE_KEY:
					env.PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dummy_key_for_tests',
				CLERK_SECRET_KEY: env.CLERK_SECRET_KEY || 'sk_test_dummy_key_for_tests'
			},
			testTimeout: 5000, // Faster timeout for unit tests
			hookTimeout: 10000,
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
			logHeapUsage: false,
			passWithNoTests: true,
			coverage: {
				enabled: false
			}
		}
	};
});
