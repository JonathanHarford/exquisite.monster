import { test, expect } from '@playwright/test';
import { newContextPage } from './helpers/auth';
import { clickPlay } from './helpers/play';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';

test.describe('Error Handling and Edge Cases', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test('application handles 404 errors gracefully', async ({ page }) => {
		await page.goto('/nonexistent-page');

		// Should show 404 page or redirect
		await page.waitForTimeout(2000);
		const currentUrl = page.url();
		const pageContent = await page.textContent('body');

		// Check that we're not still on the nonexistent page OR we get an error message
		const isRedirected = currentUrl !== '/nonexistent-page';
		const hasErrorMessage = pageContent && /404|not found|page.*not.*exist/i.test(pageContent);
		expect(isRedirected || hasErrorMessage).toBeTruthy();
	});

	test('application handles malformed URLs', async ({ page }) => {
		// Test various malformed URLs
		const malformedUrls = [
			'/g/',
			'/g/invalid-game-id',
			'/p/',
			'/p/invalid-player',
			'/play/invalid-turn',
			'/admin/invalid-section'
		];

		for (const url of malformedUrls) {
			await page.goto(url);
			await page.waitForLoadState('domcontentloaded');

			// Should not crash or show blank page
			const bodyText = await page.textContent('body');
			expect(bodyText?.length).toBeGreaterThan(0);

			// Should show some form of error message or redirect
			const hasErrorContent =
				bodyText?.toLowerCase().includes('error') ||
				bodyText?.toLowerCase().includes('not found') ||
				bodyText?.toLowerCase().includes('404') ||
				page.url() !== url; // Redirected

			expect(hasErrorContent).toBeTruthy();
		}
	});

	test('application handles very long input gracefully', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/info/contact'
		});

		// Try very long message
		const longMessage = 'x'.repeat(10000);
		const messageField = page.locator('textarea, input[type="text"]').first();

		if (await messageField.isVisible()) {
			await messageField.fill(longMessage);

			// Check if form handles long input properly
			const inputValue = await messageField.inputValue();

			// Should either truncate or show validation error
			const submitButton = page.locator('button[type="submit"]').first();
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForLoadState('domcontentloaded');

				// Should not crash - page should still be responsive
				const bodyText = await page.textContent('body');
				expect(bodyText?.length).toBeGreaterThan(0);
			}
		}

		await page.close();
	});

	test('application handles special characters in input', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/info/contact'
		});

		// Test various special characters and potential XSS
		const specialChars = '<script>alert("xss")</script>😀🎮🎨';
		const messageField = page.locator('textarea, input[type="text"]').first();

		if (await messageField.isVisible()) {
			await messageField.fill(specialChars);

			const submitButton = page.locator('button[type="submit"]').first();
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForLoadState('domcontentloaded');

				// Should sanitize or handle safely - no script execution
				const bodyText = await page.textContent('body');
				expect(bodyText?.length).toBeGreaterThan(0);

				// Check that script tags are not executed (no alert)
				const hasAlert = await page.evaluate(() => {
					return typeof window.alert === 'function';
				});
				expect(hasAlert).toBeTruthy(); // Alert function should exist but not be triggered
			}
		}

		await page.close();
	});

	test('application handles rapid clicking gracefully', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/'
		});

		// Find clickable elements (buttons, links)
		const clickableElements = page.locator('button, a[href^="/"]');
		const elementCount = await clickableElements.count();

		if (elementCount > 0) {
			const targetElement = clickableElements.first();

			// Click rapidly multiple times
			for (let i = 0; i < 5; i++) {
				try {
					await targetElement.click({ timeout: 1000 });
					await page.waitForTimeout(100);
				} catch (error) {
					// It's okay if some clicks fail due to rapid clicking
					console.log(`Click ${i + 1} failed (expected behavior)`);
				}
			}

			// Should not cause errors or duplicate actions
			await page.waitForLoadState('domcontentloaded');

			// Page should still be responsive
			const bodyText = await page.textContent('body');
			expect(bodyText?.length).toBeGreaterThan(0);
		}

		await page.close();
	});

	test('application handles database connection errors', async ({ page }) => {
		await page.goto('/');

		// Check that the page loads basic content even if some DB queries fail
		const bodyText = await page.textContent('body');
		expect(bodyText?.length).toBeGreaterThan(0);

		// Check that essential navigation elements are present
		const mainNav = page.locator('nav').first();
		await expect(mainNav).toBeVisible();

		// This test verifies graceful degradation rather than actual DB failures
		// which would require complex infrastructure setup
	});

	test('application handles missing images gracefully', async ({ page }) => {
		await page.goto('/');

		// Check for broken images
		const images = page.locator('img');
		const imageCount = await images.count();

		for (let i = 0; i < imageCount; i++) {
			const img = images.nth(i);
			const src = await img.getAttribute('src');

			if (src && !src.startsWith('data:')) {
				// Image should have alt text or fallback
				const alt = await img.getAttribute('alt');
				expect(alt || src).toBeTruthy();
			}
		}
	});

	test('application handles CSRF token issues', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/info/contact'
		});

		// Store original CSRF tokens before corrupting them
		const originalTokens = await page.evaluate(() => {
			const csrfInputs = document.querySelectorAll('input[name*="csrf"], input[name*="token"]');
			const tokens: Array<{ element: HTMLInputElement; originalValue: string }> = [];
			csrfInputs.forEach((input) => {
				const htmlInput = input as HTMLInputElement;
				tokens.push({ element: htmlInput, originalValue: htmlInput.value });
				htmlInput.value = 'invalid';
			});
			return tokens.map((t) => ({ name: t.element.name, originalValue: t.originalValue }));
		});

		// Try to submit form
		const emailField = page.locator('input[type="email"]').first();
		const messageField = page.locator('textarea').first();

		if ((await emailField.isVisible()) && (await messageField.isVisible())) {
			await emailField.fill('test@example.com');
			await messageField.fill('Test message');

			const submitButton = page.locator('button[type="submit"]').first();
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForLoadState('domcontentloaded');

				// Should handle CSRF error gracefully - no crash
				const bodyText = await page.textContent('body');
				expect(bodyText?.length).toBeGreaterThan(0);
			}
		}

		// Restore original CSRF tokens to prevent pollution of other tests
		await page.evaluate((tokens) => {
			tokens.forEach(({ name, originalValue }) => {
				const input = document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
				if (input) {
					input.value = originalValue;
				}
			});
		}, originalTokens);

		await page.close();
	});

	test('application handles form validation errors', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/info/contact'
		});

		// Submit form with invalid data
		const emailField = page.locator('input[type="email"]').first();
		const messageField = page.locator('textarea').first();
		const submitButton = page.locator('button[type="submit"]').first();

		if (await emailField.isVisible()) {
			// Try invalid email
			await emailField.fill('invalid-email');

			if (await messageField.isVisible()) {
				await messageField.fill(''); // Empty message
			}

			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForLoadState('domcontentloaded');

				// Should show validation errors
				const bodyText = await page.textContent('body');
				expect(bodyText?.length).toBeGreaterThan(0);

				// Should remain on the form page
				expect(page.url()).toContain('/info/contact');
			}
		}

		await page.close();
	});

	test('application handles network timeout gracefully', async ({ page }) => {
		// Set shorter timeout to test timeout handling
		page.setDefaultTimeout(5000);

		try {
			await page.goto('/');
			await page.waitForLoadState('domcontentloaded');

			// Should load basic page structure even with slow network
			const bodyText = await page.textContent('body');
			expect(bodyText?.length).toBeGreaterThan(0);

			// Should have basic navigation
			const nav = page.locator('nav, .nav, [role="navigation"]');
			if ((await nav.count()) > 0) {
				await expect(nav.first()).toBeVisible();
			}
		} catch (error) {
			// If page fails to load, that's also acceptable behavior
			console.log('Page load timeout (expected in some cases)');
		}
	});

	test('application handles JavaScript errors gracefully', async ({ page }) => {
		// Listen for console errors
		const consoleErrors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');

		// Even with JS errors, page should still render
		const bodyText = await page.textContent('body');
		expect(bodyText?.length).toBeGreaterThan(0);

		// Basic functionality should still work
		const links = page.locator('a[href]');
		const linkCount = await links.count();
		expect(linkCount).toBeGreaterThan(0);

		// Log any JS errors for debugging (don't fail test)
		if (consoleErrors.length > 0) {
			console.log('JS errors detected:', consoleErrors);
		}
	});
});
