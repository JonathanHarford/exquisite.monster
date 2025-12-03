import { test, expect } from '@playwright/test';
import { isAuthed, isLoggedOut, newContextPage } from './helpers/auth';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';
import { TIMEOUTS } from './helpers/timing';

test.describe('Authentication', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test('shows login/waitlist buttons when not authenticated', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');

		// Wait for the page to be fully loaded
		await page.waitForSelector('nav', { state: 'visible' });

		await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
	});

	test('protected routes redirect to signup when not authenticated', async ({ page }) => {
		await page.goto('/account');
		await page.waitForURL('/');
	});

	test('authenticated users can access protected routes', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/account',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		await expect(await isAuthed(page)).toBe(true);
		await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
		await page.close();
	});

	test('authenticated users see Play button in nav', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		await expect(await isAuthed(page)).toBe(true);

		// Look for Play button/link - it could be in desktop nav or bottom nav
		const playButton = page.locator('a[href="/play"]').first();
		await expect(playButton).toBeVisible({ timeout: TIMEOUTS.STANDARD });

		await page.close();
	});

	test('admin users can access admin routes', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/admin',
			storageState: 'tests/e2e/.auth/admin.json'
		});

		await expect(await isAuthed(page)).toBe(true);
		await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
		await page.close();
	});

	test('non-admin users cannot access admin routes', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/admin',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Wait for page to load
		await page.waitForTimeout(2000);

		// Non-admin users should not see admin dashboard heading or should be redirected
		const hasAdminDashboard = await page
			.locator('h1, h2')
			.filter({ hasText: /admin dashboard/i })
			.isVisible();
		const currentUrl = page.url();

		// Either redirected away from admin OR doesn't show admin dashboard
		expect(!hasAdminDashboard || !currentUrl.includes('/admin')).toBe(true);
		await page.close();
	});
});
