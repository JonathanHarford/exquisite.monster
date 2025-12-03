import type { Page, Locator } from '@playwright/test';

/**
 * Optimized timing constants for faster test execution
 */
export const TIMEOUTS = {
	// Fast operations (most UI interactions)
	FAST: 3000,

	// Standard operations (navigation, form submission)
	STANDARD: 5000,

	// Slow operations (complex page loads, external calls)
	SLOW: 8000,

	// Very slow operations (only for complex integrations)
	VERY_SLOW: 15000
} as const;

/**
 * Optimized navigation helper
 */
export async function navigateToPage(page: Page, url: string, waitForSelector?: string) {
	await page.goto(url);
	await page.waitForLoadState('domcontentloaded');

	if (waitForSelector) {
		await page.waitForSelector(waitForSelector, { timeout: TIMEOUTS.STANDARD });
	}
}

/**
 * Optimized element visibility check
 */
export async function expectElementVisible(page: Page, selector: string, timeout: number = TIMEOUTS.FAST) {
	const element = page.locator(selector).first();
	await element.waitFor({ state: 'visible', timeout });
	return element;
}

/**
 * Optimized form submission with navigation
 */
export async function submitFormAndWait(
	page: Page,
	submitSelector: string,
	expectedUrl?: string | RegExp,
	timeout: number = TIMEOUTS.STANDARD
) {
	const navigationPromise = expectedUrl ? page.waitForURL(expectedUrl, { timeout }) : null;

	await page.locator(submitSelector).click();

	if (navigationPromise) {
		await navigationPromise;
	} else {
		await page.waitForLoadState('domcontentloaded');
	}
}

/**
 * Wait for element to be ready for interaction
 */
export async function waitForInteractable(
	page: Page,
	selector: string,
	timeout: number = TIMEOUTS.STANDARD
) {
	const element = page.locator(selector);
	await element.waitFor({ state: 'visible', timeout });
	await element.waitFor({ state: 'attached', timeout });
	return element;
}

/**
 * Optimized text input with validation
 */
export async function fillAndValidate(
	page: Page,
	selector: string,
	value: string,
	timeout: number = TIMEOUTS.FAST
) {
	const element = await waitForInteractable(page, selector, timeout);
	await element.fill(value);

	// Verify the value was set
	await element.evaluate((el: HTMLInputElement | HTMLTextAreaElement, val) => {
		if (el.value !== val) {
			throw new Error(`Input value mismatch: expected "${val}", got "${el.value}"`);
		}
	}, value);

	return element;
}
