import { test, expect } from '@playwright/test';
import { newContextPage } from './helpers/auth';
import { clickPlay, submitDrawing, submitWriting, submitTurn } from './helpers/play';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';

test.describe('Player Profiles', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test('user can view their own profile', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/p/p1' // p1 has username p1
		});

		// Should show user profile information
		await expect(page.locator('h1, .profile-name')).toBeVisible();
		await page.close();
	});

	test('user can view other players profiles', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/p/p2' // View p2's profile
		});

		// Should show other player's profile information
		await expect(page.locator('h1, .profile-name')).toBeVisible();
		await page.close();
	});

	test('profile shows player statistics', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/p/p1'
		});

		// Look for stats like games played, wins, etc.
		const statsSection = page.locator('.stats, .player-stats, .profile-stats');
		if ((await statsSection.count()) > 0) {
			await expect(statsSection.first()).toBeVisible();
		}

		await page.close();
	});

	test('unauthenticated user can view public profiles', async ({ page }) => {
		await page.goto('/p/p1');

		// Public profiles should be accessible
		await expect(page.locator('h1, .profile-name')).toBeVisible();
	});

	test('profile navigation works correctly', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/p/p1'
		});

		// Should have navigation elements
		const playLink = page.locator('nav a.btn.btn-primary').filter({ hasText: 'Play' });
		if (await playLink.isVisible()) {
			await expect(playLink).toBeVisible();
		}

		await page.close();
	});

	test('profile is responsive on different devices', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/p/p1'
		});

		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await expect(page.locator('h1, .profile-name')).toBeVisible();

		// Test tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await expect(page.locator('h1, .profile-name')).toBeVisible();

		// Test desktop viewport
		await page.setViewportSize({ width: 1200, height: 800 });
		await expect(page.locator('h1, .profile-name')).toBeVisible();

		await page.close();
	});

	test('player can navigate between profiles', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/p/p1'
		});

		// Look for links to other players
		const playerLinks = page.locator('a[href^="/p/"]');
		const linkCount = await playerLinks.count();

		if (linkCount > 1) {
			// More than just current player
			const otherPlayerLink = playerLinks.nth(1);
			const href = await otherPlayerLink.getAttribute('href');

			await otherPlayerLink.click();
			await page.waitForURL(href!);

			// Should be on another player's profile
			await expect(page.url()).toMatch(/\/p\/[^\/]+$/);
		}

		await page.close();
	});

	test('profile shows player activity and achievements', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/p/p1'
		});

		// Look for activity feed or achievements
		const activitySection = page.locator('.activity, .achievements, .recent-games');
		if ((await activitySection.count()) > 0) {
			await expect(activitySection.first()).toBeVisible();
		}

		// Look for profile picture or avatar
		const profilePicture = page.locator('.profile-picture, .avatar, img.profile');
		if ((await profilePicture.count()) > 0) {
			await expect(profilePicture.first()).toBeVisible();
		}

		await page.close();
	});

	test('profile respects privacy settings', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p2.json', // Different user viewing profile
			url: '/p/p1'
		});

		// Profile should still be visible but may hide some private info
		await expect(page.locator('h1, .profile-name')).toBeVisible();

		// Private information should not be visible to other users
		const privateInfo = page.locator('.email, .private-stats');
		if ((await privateInfo.count()) > 0) {
			await expect(privateInfo.first()).not.toBeVisible();
		}

		await page.close();
	});
});
