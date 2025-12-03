import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export default defineConfig({
	globalSetup: './tests/e2e/setup/global-setup.ts',
	globalTeardown: './tests/e2e/setup/global-teardown.ts',

	webServer: {
		command: 'npm run dev -- --port 3793',
		port: 3793,
		reuseExistingServer: !process.env.CI, // Allows local dev server usage
		timeout: 120 * 1000, // Longer timeout for build + preview
		env: {
			PLAYWRIGHT_TEST: 'true',
			...process.env
		}
	},
	timeout: 60_000, // Timeout for test operations
	expect: {
		timeout: 5_000 // Reduced from 15s for faster failures
	},
	use: {
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		trace: 'retain-on-failure',
		// Base URL to use in actions like `await page.goto('/')`.
		baseURL: 'http://localhost:3793',
		// Optimize timeouts for faster execution
		navigationTimeout: 10_000, // Reduced from 30s
		actionTimeout: 5_000 // Reduced from 15s
		// headless: false,
	},
	testDir: 'tests/e2e',
	// Configure TypeScript to use SvelteKit's tsconfig for proper module resolution
	tsconfig: './tsconfig.json',
	// Keep at 1 worker until race conditions are fully resolved
	workers: process.env.CI ? 1 : 1,
	projects: [
		{
			name: 'setup',
			testMatch: /setup\/.*\.setup\.ts/
		},
		{
			name: 'e2e',
			testMatch: /.*\.test\.ts/,
			dependencies: ['setup']
		}
	]
});
