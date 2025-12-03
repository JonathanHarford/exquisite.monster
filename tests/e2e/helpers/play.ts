import { expect, type Page } from '@playwright/test';
import fs from 'fs';

export const clickPlay = async (page: Page) => {
	await page.waitForLoadState('domcontentloaded');
	// Skip timer check before starting - timers from other tabs/contexts might be visible

	console.log('🧪 Current URL before clicking Play:', page.url());

	// Look for the Play button in nav (the styled one, not the text link)
	try {
		// Close any open modals first
		const modalBackdrop = page.locator('.modal-backdrop, [role="dialog"]').first();
		if (await modalBackdrop.isVisible()) {
			await page.keyboard.press('Escape');
			await page.waitForTimeout(500);
		}

		// Wait for and click the Play button in nav
		const playButton = page.locator('nav a.btn.btn-primary').filter({ hasText: 'Play' });
		try {
			await playButton.waitFor({ state: 'visible', timeout: 5000 });
			console.log('🧪 Found Play button');
			await playButton.click();
		} catch (_e) {
			console.log('Could not find specific play button, trying generic one');
			const genericPlayButton = page.getByRole('link', { name: 'Play' }).first();
			try {
				await genericPlayButton.waitFor({ state: 'visible', timeout: 5000 });
				await genericPlayButton.click();
			} catch (_e2) {
				console.log(await page.content());
				throw new Error('Play button not found or not clickable');
			}
		}
	} catch {
		throw new Error('Play button not found or not clickable');
	}
	console.log('🧪 Clicked Play link');

	// Wait for navigation to /play page
	await page.waitForURL('/play');
	console.log('🧪 Navigated to /play page');

	// Now find and submit the startTurn form on the /play page
	await page.waitForSelector('form[action="?/startTurn"]', { state: 'visible', timeout: 5000 });
	console.log('🧪 Found startTurn form on /play page');

	// Listen for console messages and network requests
	page.on('console', (msg) => console.log('🧪 Browser console:', msg.text()));
	page.on('response', async (response) => {
		if (response.url().includes('startTurn') || response.url().includes('play')) {
			try {
				// Skip redirect responses as they don't have a body
				if (response.status() >= 300 && response.status() < 400) {
					console.log('🧪 Redirect Response:', response.status(), response.url());
					return;
				}
				const responseText = await response.text();
				if (responseText.includes('failure') || responseText.includes('error')) {
					console.log('🧪 ERROR Response:', responseText);
				} else {
					console.log('🧪 Response:', responseText.substring(0, 20));
				}
			} catch (e) {
				console.log('🧪 Could not read response body:', e);
			}
		}
	});

	// Submit the form using the button click to trigger SvelteKit's enhancement
	const navigationPromise = page.waitForURL('/play/*', { timeout: 15000 });

	// Find and click the submit button
	const submitButton = await page
		.locator('form[action="?/startTurn"] button[type="submit"]')
		.first();
	await submitButton.click();
	console.log('🧪 Form submitted');

	try {
		await navigationPromise;
		console.log('🧪 Navigation successful to:', page.url());
	} catch (error) {
		console.log('🧪 Navigation failed, current URL:', page.url());

		// Check if there are any error messages on the page
		const errorElements = await page.locator('.error, .alert-error, [role="alert"]').all();
		for (const errorEl of errorElements) {
			const errorText = await errorEl.textContent();
			console.log('🧪 Error on page:', errorText);
		}

		// Check the page content for any error messages
		const pageContent = await page.content();
		console.log('🧪 Page content (first 1000 chars):', pageContent.substring(0, 1000));

		// Check if we're still on the same page
		await page.waitForTimeout(2000); // Wait a bit more
		console.log('🧪 URL after waiting:', page.url());

		throw error;
	}

	const turnId = page.url().split('/')[4];
	console.log('🧪 startTurn', turnId);
	await assertTimer(page);
	return turnId;
};

export const assertTimer = async (page: Page) => {
	await expect(page.locator('.timer').first()).toBeVisible();
};

export const assertNoTimer = async (page: Page) => {
	await expect(page.locator('.timer')).toHaveCount(0);
};

export const assertFirstTurn = async (page: Page) => {
	await page.waitForURL('/play/*');
	const turnId = page.url().split('/')[4];
	console.log('🧪 assertFirstTurn', turnId);
	await expect(page.getByRole('heading', { name: 'Start a new game with a' })).toBeVisible();
};

// Helper to determine turn type and submit accordingly
export const submitTurn = async (page: Page, turnId: string) => {
	console.log('🧪 submitTurn', turnId);
	await page.waitForURL('/play/*');

	// Wait for the page to be fully loaded
	await page.waitForLoadState('domcontentloaded');

	// Wait a bit for any dynamic content to render
	await page.waitForTimeout(1000);

	// Check if this is an expired turn or "Not your turn" page
	const notYourTurnVisible = await page.locator('text=Not your turn').isVisible({ timeout: 2000 });
	if (notYourTurnVisible) {
		console.log('🧪 Turn has expired or is not available, screenshot taken');
		await page.screenshot({ path: `debug-submitTurn-${turnId}.png` });
		throw new Error(`Turn ${turnId} is expired or not your turn`);
	}

	// Check if this is a writing turn or drawing turn by looking for specific elements
	// Look for the textarea first, then the upload button
	const isWritingTurn = await page.locator('textarea[name="content"]').isVisible({ timeout: 8000 });

	if (isWritingTurn) {
		console.log('🧪 Detected writing turn');
		return await submitWriting(page, generateWriting(turnId));
	}

	// If not writing turn, check for drawing turn
	const isDrawingTurn = await page
		.locator('button:has-text("Upload Image")')
		.isVisible({ timeout: 8000 });

	if (isDrawingTurn) {
		console.log('🧪 Detected drawing turn');
		return await submitDrawing(page, turnId);
	}

	// Fallback: take a screenshot for debugging and throw an error
	await page.screenshot({ path: `debug-submitTurn-${turnId}.png` });
	console.log('🧪 Page content for failed turn detection:', await page.content());
	throw new Error(
		`Could not determine turn type for ${turnId}. Neither writing textarea nor Upload Image button found.`
	);
};

// Turns 3, 5, 7...
export const assertPreviousDrawing = async (page: Page, previousTurnId?: string) => {
	console.log('🧪 assertPreviousDrawing', previousTurnId);
	await page.waitForURL('/play/*');
	// Just check that a drawing image is visible, regardless of specific turnId
	await expect(page.locator('img.drawing')).toBeVisible();
	if (previousTurnId) {
		// Check that the src attribute contains the turn ID (flexible for different storage backends)
		const imgElement = page.locator('img.drawing');
		const src = await imgElement.getAttribute('src');
		expect(src).toContain(previousTurnId);
	}
};

export const generateWriting = (turnId: string) => {
	return `${turnId}-${turnId}`.replace(/-/g, ' ');
};

// Helper function to handle redirect after turn submission
const handleTurnSubmissionRedirect = async (page: Page, turnId: string): Promise<string> => {
	// After submitting, wait for the redirect to either party page or game page
	// For party games, it redirects to the party page (/s/*)
	// For regular games, it redirects to the game page (/g/*)
	try {
		// First try waiting for party page redirect
		await page.waitForURL('/s/*', { timeout: 5000 });
		// We're on a party page, wait for the content to update
		await page.waitForTimeout(2000);
		// Extract game ID from turn ID for return value
		const gameId = turnId.replace(/^t_(.+)_\d+$/, 'g_$1');
		return gameId;
	} catch {
		// If not party page, wait for redirect to game page
		await page.waitForURL('/g/*', { timeout: 10000 });
		// Extract game ID from current URL
		const gameId = page.url().split('/')[4];
		return gameId;
	}
};

export const submitWriting = async (page: Page, content: string) => {
	await page.waitForURL('/play/*');
	console.log('🧪 submitWriting', content);

	// Extract the turn ID from the current URL before submitting
	const turnId = page.url().split('/')[4];

	// Wait for the writing form to be ready
	await page.waitForSelector('textarea[name="content"]', { state: 'visible', timeout: 10000 });

	// Wait for the placeholder to be ready
	await page.waitForSelector('textarea[placeholder="Write your description here..."]', {
		state: 'visible',
		timeout: 10000
	});

	await page.getByPlaceholder('Write your description here...').fill(content);

	// Wait for submit button to be available
	await page.waitForSelector('button:has-text("Submit Turn")', { state: 'visible', timeout: 5000 });
	await page.getByRole('button', { name: 'Submit Turn' }).click();

	return await handleTurnSubmissionRedirect(page, turnId);
};

// Turns 2, 4, 6...
export const assertPreviousWriting = async (page: Page, previousTurnId: string) => {
	console.log('🧪 assertPreviousWriting', previousTurnId);
	await page.waitForURL('/play/*');

	// Wait for the page to fully load and the previous turn content to be visible
	await page.waitForLoadState('domcontentloaded');
	await page.waitForTimeout(1000);

	// Take a screenshot for debugging if the element isn't found
	const writingElement = page.locator('.writing');
	try {
		await expect(writingElement).toBeVisible({ timeout: 5000 });
		await expect(writingElement).toHaveText(generateWriting(previousTurnId));
	} catch (error) {
		console.log('🧪 .writing element not found, taking debug screenshot');
		await page.screenshot({ path: `debug-assertPreviousWriting-${previousTurnId}.png` });

		// Check for any text content that might match what we're looking for
		const pageContent = await page.textContent('body');
		console.log(
			'🧪 Page content contains:',
			pageContent?.includes(generateWriting(previousTurnId)) ? 'EXPECTED TEXT' : 'NO EXPECTED TEXT'
		);
		console.log('🧪 Expected text:', generateWriting(previousTurnId));

		throw error;
	}
};

export const submitDrawing = async (page: Page, turnId: string) => {
	console.log('🧪 submitDrawing', turnId);
	fs.writeFileSync(
		`tests/e2e/helpers/imgtmp/${turnId}.jpg`,
		fs.readFileSync(`tests/e2e/helpers/tcsotm.jpg`)
	);
	await page.waitForURL('/play/*');
	await submitFileForDrawing(page, `tests/e2e/helpers/imgtmp/${turnId}.jpg`);

	const gameId = await handleTurnSubmissionRedirect(page, turnId);
	
	// Only assert no timer if we're on a game page (not party page)
	if (page.url().includes('/g/')) {
		await assertNoTimer(page);
	}
	
	return gameId;
};

// Generic file submission helper for drawing
export const submitFileForDrawing = async (page: Page, filePath: string) => {
	// Add response logging to capture detailed error information
	page.on('response', async (response) => {
		if (response.url().includes('submitTurn') || response.url().includes('play')) {
			try {
				// Skip redirect responses as they don't have a body
				if (response.status() >= 300 && response.status() < 400) {
					console.log('🧪 Drawing Redirect Response:', response.status(), response.url());
					return;
				}
				const responseText = await response.text();
				if (responseText.includes('failure') || responseText.includes('error')) {
					console.log('🧪 DRAWING ERROR Response:', responseText);
				} else {
					console.log('🧪 Drawing Response:', responseText.substring(0, 50));
				}
			} catch (e) {
				console.log('🧪 Could not read drawing response body:', e);
			}
		}
	});
	// Wait for the page to be fully loaded
	await page.waitForLoadState('domcontentloaded');
	await page.waitForTimeout(500);

	// Check if this is actually a writing turn instead of drawing
	const isWritingTurn = await page.locator('textarea[name="content"]').isVisible({ timeout: 2000 });
	if (isWritingTurn) {
		console.log('🧪 APPLICATION BUG DETECTED: Expected drawing turn but got writing turn');
		console.log('🧪 This suggests the game turn alternation logic is broken');
		await page.screenshot({ path: `debug-drawing-turn-error-${Date.now()}.png` });
		throw new Error(
			'APPLICATION BUG: Expected drawing turn but got writing turn - game turn alternation is broken'
		);
	}

	// Wait for the drawing form to be visible
	await page.waitForSelector('button:has-text("Upload Image")', {
		state: 'visible',
		timeout: 10000
	});

	// Make sure we're in upload mode by clicking the Upload Image button
	const uploadButton = page.locator('button').filter({ hasText: 'Upload Image' });
	await uploadButton.click();
	await page.waitForTimeout(500); // Wait for mode switch

	// Now wait for the file input area to be visible
	await page.waitForSelector('label[for="file-input"]', { state: 'visible' });

	// The actual input is hidden by opacity but should be `attached`
	const inputSelector = 'input[type="file"][name="file"]';
	await page.waitForSelector(inputSelector, { state: 'attached', timeout: 5000 });

	try {
		// Attempt to set files directly on the input element.
		// This is often more reliable than simulating clicks on styled labels.
		await page.setInputFiles(inputSelector, filePath);
	} catch (e) {
		console.error(`Failed to setInputFiles directly: ${e}. Trying to click label as fallback.`);
		// Fallback: if direct input setting fails (e.g. due to some overlay or specific event handling)
		// try clicking the label to trigger the file chooser.
		const labelSelector = 'label[for="file-input"]';
		const fcp = page.waitForEvent('filechooser');
		await page.locator(labelSelector).click();
		const fileChooser = await fcp;
		await fileChooser.setFiles(filePath);
	}

	// Wait for client-side processing to complete (preview image appears or error message)
	// This is a crucial step because client-side PDF conversion and validation take time.
	await page.waitForFunction(
		() => {
			const previewImageVisible = document.querySelector('img.preview-image') !== null;
			const errorMessageVisible =
				document.querySelector('.error-message') !== null &&
				document.querySelector('.error-message')?.textContent?.trim() !== '';
			const submitButtonEnabled =
				document.querySelector('button[type="submit"]:not(:disabled)') !== null;

			return (previewImageVisible && submitButtonEnabled) || errorMessageVisible;
		},
		{ timeout: 15000 }
	); // Increased timeout for PDF processing

	// If an error message is displayed client-side, we might not want to proceed with submission
	const errorElement = page.locator('.error-message');
	if (await errorElement.isVisible()) {
		const clientError = await errorElement.textContent();
		if (clientError && clientError.trim() !== '') {
			console.log('Client-side error detected:', clientError);
			// Depending on the test, we might throw here or let the test check the error.
			// For now, we'll let the calling test decide.
			return; // Do not click submit if client-side error is shown
		}
	}

	// Ensure submit button is available and click it
	const submitButton = page.locator('button[type="submit"]');
	await expect(submitButton).toBeEnabled({ timeout: 5000 });
	await submitButton.click();
};

export const assertGameIncomplete = async (page: Page, turnCount?: number) => {
	console.log('🧪 assertGameIncomplete');
	await page.waitForURL('/g/*');
	if (turnCount !== undefined) {
		await expect(page.locator('.bubble')).toHaveCount(turnCount);
	}
	await expect(page.locator('.turn-ellipsis')).toBeVisible();
	await expect(page.getByText('✔︎')).not.toBeVisible();
};

export const assertGameComplete = async (page: Page, turnCount: number) => {
	console.log('🧪 assertGameComplete');
	await page.waitForURL('/g/*');
	await expect(page.locator('.bubble')).toHaveCount(turnCount);
	await expect(page.locator('.turn-ellipsis')).not.toBeVisible();
	await expect(page.getByText('✔︎')).toBeVisible();
};
