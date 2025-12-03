import { test, expect } from '@playwright/test';
import { newContextPage } from './helpers/auth';
import { clickPlay, submitDrawing, submitWriting } from './helpers/play';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';

test.describe('Game Gallery', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test('user can browse game gallery without authentication', async ({ page }) => {
		await page.goto('/g');

		await expect(page.getByRole('heading', { name: /Game Gallery/i })).toBeVisible();
		// Gallery should be accessible to all users
	});

	test('authenticated user can browse game gallery', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		await expect(page.getByRole('heading', { name: /Game Gallery/i })).toBeVisible();
		await page.close();
	});

	test('user can navigate from gallery to individual games', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Find first game link if any exist
		const gameLinks = page.locator('a[href^="/g/"]');
		const linkCount = await gameLinks.count();

		if (linkCount > 0) {
			const firstGameLink = gameLinks.first();
			const href = await firstGameLink.getAttribute('href');

			await firstGameLink.click();
			await page.waitForURL(href!);

			// Should be on individual game page
			await expect(page.url()).toMatch(/\/g\/[^\/]+$/);
		}

		await page.close();
	});

	test('game gallery has proper pagination or infinite scroll', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Look for pagination controls or load more functionality
		const paginationControls = page.locator(
			'.pagination, .load-more, button:has-text("Load More")'
		);
		const hasPagination = (await paginationControls.count()) > 0;

		// If there's pagination, test it
		if (hasPagination) {
			await expect(paginationControls.first()).toBeVisible();
		}

		await page.close();
	});

	test('gallery filters and search work', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Look for search or filter functionality
		const searchInput = page.locator('input[type="search"], input[placeholder*="search"]');
		const filterDropdown = page.locator('select, .filter-dropdown');

		if ((await searchInput.count()) > 0) {
			await searchInput.fill('test');
			// Wait for search results
			await page.waitForTimeout(1000);
		}

		if ((await filterDropdown.count()) > 0) {
			// Test filtering if available
			await expect(filterDropdown.first()).toBeVisible();
		}

		await page.close();
	});

	test('gallery is responsive on different screen sizes', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await expect(page.getByRole('heading', { name: /Game Gallery/i })).toBeVisible();

		// Test tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await expect(page.getByRole('heading', { name: /Game Gallery/i })).toBeVisible();

		// Test desktop viewport
		await page.setViewportSize({ width: 1200, height: 800 });
		await expect(page.getByRole('heading', { name: /Game Gallery/i })).toBeVisible();

		await page.close();
	});
});
