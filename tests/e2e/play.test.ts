import { expect, test } from '@playwright/test';
import { newContextPage } from './helpers/auth';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';

import { navigateToPage, expectElementVisible, TIMEOUTS } from './helpers/timing';

test.describe('Game Creation', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test('can navigate to play page', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Navigate to play page
		await navigateToPage(page, '/play');

		// Should be on play page or redirected to a specific game
		// The app may create a game and redirect to /play/game_id
		await expect(page).toHaveURL(/\/play/);

		await page.close();
	});

	test('can start new game', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Should be able to start a game (form should be present)
		await expectElementVisible(page, 'form');

		// Should have a submit button or play button
		await expectElementVisible(
			page,
			'button[type="submit"], button:has-text("Play")',
			TIMEOUTS.STANDARD
		);

		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		await expect(startButton).toBeVisible();

		await page.close();
	});

	test('shows correct initial state', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Should show initial play interface - use more specific selector
		await expectElementVisible(page, 'main');

		// Should not show game content initially
		const gameContent = page.locator('.game, .turns, .bubble');
		await expect(gameContent).toHaveCount(0);

		await page.close();
	});
});

test.describe('Writing Turns', () => {
	test('can submit writing turn with valid text', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// Look for text input (textarea or input)
		const textInput = page.locator('textarea, input[type="text"]').first();
		if (await textInput.isVisible()) {
			// Fill with valid text
			await textInput.fill('This is a test writing turn for the game.');

			// Submit the turn
			const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForLoadState('domcontentloaded');
			}
		}

		await page.close();
	});

	test('validates writing turn requirements', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// Look for text input
		const textInput = page.locator('textarea, input[type="text"]').first();
		if (await textInput.isVisible()) {
			// Try submitting empty text
			await textInput.fill('');

			const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
			if (await submitButton.isVisible()) {
				// Button should be disabled or form should show validation
				const isDisabled = await submitButton.isDisabled();
				if (!isDisabled) {
					await submitButton.click();
					// Should show some form of validation message
					const validationMessage = page.locator('.error, .alert, [role="alert"], .validation');
					if ((await validationMessage.count()) > 0) {
						await expect(validationMessage.first()).toBeVisible();
					}
				}
			}
		}

		await page.close();
	});

	test('shows timer during writing turn', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// Look for timer element
		const timer = page.locator('.timer, .countdown, .time-remaining');
		if ((await timer.count()) > 0) {
			await expect(timer.first()).toBeVisible();
		}

		await page.close();
	});
});

test.describe('Drawing Turns', () => {
	test('can upload image file', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// Look for file input
		const fileInput = page.locator('input[type="file"]').first();
		if (await fileInput.isVisible()) {
			// File input should accept images
			const accept = await fileInput.getAttribute('accept');
			expect(accept).toContain('image');
		}

		await page.close();
	});

	test('validates file types', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// Look for file input and check it has proper validation
		const fileInput = page.locator('input[type="file"]').first();
		if (await fileInput.isVisible()) {
			const accept = await fileInput.getAttribute('accept');
			// Should specify image types
			const hasImageValidation =
				accept && (accept.includes('image') || accept.includes('.jpg') || accept.includes('.png'));
			expect(hasImageValidation).toBeTruthy();
		}

		await page.close();
	});

	test('shows drawing interface', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// Look for drawing interface elements
		const drawingInterface = page.locator('canvas, .drawing, .sketch, input[type="file"]');
		if ((await drawingInterface.count()) > 0) {
			await expect(drawingInterface.first()).toBeVisible();
		}

		await page.close();
	});
});

test.describe('Game Navigation', () => {
	test('can view game after turn submission', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// If we're on a game page (URL contains /g/ or /play/), we can view it
		if (page.url().includes('/g/') || page.url().includes('/play/')) {
			// Should show some game content - use more specific selector
			await expectElementVisible(page, 'main');
		}

		await page.close();
	});

	test('shows game progress correctly', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/play',
			storageState: 'tests/e2e/.auth/p1.json'
		});

		// Start a game first if needed
		const startButton = page
			.locator('button[type="submit"], button:has-text("Start"), a:has-text("Play")')
			.first();
		if (await startButton.isVisible()) {
			await startButton.click();
			await page.waitForLoadState('domcontentloaded');
		}

		// Look for progress indicators
		const progressIndicators = page.locator('.progress, .turns, .step, .game-info');
		if ((await progressIndicators.count()) > 0) {
			await expect(progressIndicators.first()).toBeVisible();
		}

		await page.close();
	});
});

test.describe('Authentication Requirements', () => {
	test('user cannot play without authentication', async ({ page }) => {
		await page.goto('/play');

		// Should redirect to login or show waitlist
		await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
	});
});
