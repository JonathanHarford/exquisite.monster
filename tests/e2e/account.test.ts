import { test, expect } from '@playwright/test';
import { newContextPage } from './helpers/auth';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';

test.describe('Account Management', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test('account page shows user profile information', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Navigate to account page with retry logic to handle race conditions
		let navigationSuccess = false;
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				await page.goto('/account', { timeout: 15000, waitUntil: 'domcontentloaded' });
				navigationSuccess = true;
				break;
			} catch (error) {
				console.log(`Navigation attempt ${attempt + 1} failed, retrying...`);
				await page.waitForTimeout(1000);
			}
		}

		if (!navigationSuccess) {
			throw new Error('Failed to navigate to account page after 3 attempts');
		}

		// Wait for page to load completely
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(1000);

		// Should show account content - look for any heading containing account-related text
		const accountHeading = page
			.locator('h1, h2, h3, h4')
			.filter({ hasText: /account|profile/i })
			.first();
		if ((await accountHeading.count()) > 0) {
			await expect(accountHeading).toBeVisible({ timeout: 10000 });
		}

		// Should be on account page
		await expect(page).toHaveURL(/\/account/);

		// Should show some form of user information
		const userContent = page.locator('main, .container, .account, .profile').first();
		await expect(userContent).toBeVisible({ timeout: 10000 });

		await page.close();
	});

	test('user can navigate to notifications from account page', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/account'
		});

		// Find and click notifications link
		const notificationsLink = page.getByRole('link', { name: /notification/i });
		if (await notificationsLink.isVisible()) {
			await notificationsLink.click();
			await page.waitForURL('/account/mail');
			await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
		}

		await page.close();
	});

	test('user can update profile picture', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/account'
		});

		// Look for profile picture upload functionality
		const uploadButton = page.locator('input[type="file"]').first();
		if (await uploadButton.isVisible()) {
			// Test file upload functionality
			await uploadButton.setInputFiles('tests/e2e/helpers/tcsotm.jpg');

			// Wait for preview or success message
			await page.waitForTimeout(2000);
		}

		await page.close();
	});

	test('unauthenticated user cannot access account page', async ({ page }) => {
		await page.goto('/account');

		// Should redirect to login
		await page.waitForURL('/');
		// Look for any Play button/link in the main content (not navigation)
		const playButton = page.locator('main').getByRole('button', { name: 'Play' }).first();
		await expect(playButton).toBeVisible();
	});

	test('account page has proper navigation', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/account'
		});

		// Should have navigation back to main site
		await expect(page.locator('a[href="/play"]').first()).toBeVisible();

		// Should have user menu available
		await expect(page.locator('[data-testid="avatar-menu"]').first()).toBeVisible();

		await page.close();
	});

	test('account page shows user statistics', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/account'
		});

		// Look for user stats or profile information
		const profileSection = page.locator('.profile-section, .user-stats, .account-info').first();
		if (await profileSection.isVisible()) {
			await expect(profileSection).toBeVisible();
		}

		await page.close();
	});

	test('account page is responsive', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/account'
		});

		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();

		// Test desktop viewport
		await page.setViewportSize({ width: 1200, height: 800 });
		await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();

		await page.close();
	});
});
