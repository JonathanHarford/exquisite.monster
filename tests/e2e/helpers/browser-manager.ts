import type { Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Manages browser contexts for optimal reuse across tests
 */
export class BrowserManager {
	private static contexts = new Map<string, BrowserContext>();

	/**
	 * Get or create an authenticated browser context
	 */
	static async getAuthenticatedContext(
		browser: Browser,
		authFile: string
	): Promise<BrowserContext> {
		const cacheKey = `${browser.browserType().name()}_${authFile}`;

		if (!this.contexts.has(cacheKey)) {
			const context = await browser.newContext({
				storageState: authFile,
				// Optimize context settings
				viewport: { width: 1280, height: 720 },
				// Reduce resource usage
				ignoreHTTPSErrors: true,
				// Speed up by reducing image loading
				extraHTTPHeaders: {
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
				}
			});

			this.contexts.set(cacheKey, context);
		}

		return this.contexts.get(cacheKey)!;
	}

	/**
	 * Get or create an authenticated page
	 */
	static async getAuthenticatedPage(
		browser: Browser,
		authFile: string,
		url?: string
	): Promise<Page> {
		const context = await this.getAuthenticatedContext(browser, authFile);
		const page = await context.newPage();

		if (url) {
			await page.goto(url);
			await page.waitForLoadState('domcontentloaded');
		}

		return page;
	}

	/**
	 * Clean up all contexts (call in global teardown)
	 */
	static async cleanup() {
		for (const context of this.contexts.values()) {
			await context.close();
		}
		this.contexts.clear();
	}

	/**
	 * Clean up specific context
	 */
	static async cleanupContext(authFile: string) {
		for (const [key, context] of this.contexts.entries()) {
			if (key.includes(authFile)) {
				await context.close();
				this.contexts.delete(key);
			}
		}
	}
}

/**
 * Optimized page creation helper for backward compatibility
 */
export async function createOptimizedPage(
	browser: Browser,
	options: {
		url?: string;
		storageState?: string;
	}
): Promise<Page> {
	if (options.storageState) {
		return BrowserManager.getAuthenticatedPage(browser, options.storageState, options.url);
	}

	// Non-authenticated page
	const context = await browser.newContext({
		viewport: { width: 1280, height: 720 },
		ignoreHTTPSErrors: true
	});

	const page = await context.newPage();

	if (options.url) {
		await page.goto(options.url);
		await page.waitForLoadState('domcontentloaded');
	}

	return page;
}
