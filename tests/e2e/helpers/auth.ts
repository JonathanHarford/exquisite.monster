import { type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

export const isAuthed = async (page: Page) => {
	// Check for authenticated state by looking for either:
	// 1. Play link in navigation (authenticated users)
	// 2. Avatar menu in navigation
	const playLink = page.locator('nav a[href="/play"]').first();
	const avatarMenu = page.locator('[data-testid="avatar-menu"]').first();

	return (await playLink.isVisible()) || (await avatarMenu.isVisible());
};
export const isLoggedOut = async (page: Page) => {
	return await page.getByRole('button', { name: 'Sign In' }).isVisible();
};

export const newContextPage = async (
	browser: Browser,
	opts?: { url?: string; storageState?: string }
) => {
	const new_context = await browser.newContext({ storageState: opts?.storageState });
	const new_page = await new_context.newPage();
	const url = opts?.url ?? '/';
	if (opts?.url) {
		await new_page.goto(url, { waitUntil: 'domcontentloaded' });
	}
	return new_page;
};

export const authenticatedContext = async (page: Page, authFilePath: string) => {
	const context = page.context();
	
	try {
		const authState = JSON.parse(readFileSync(authFilePath, 'utf-8'));
		if (authState.cookies) {
			await context.addCookies(authState.cookies);
		}
		if (authState.origins) {
			for (const origin of authState.origins) {
				await context.addInitScript(() => {
					for (const [key, value] of Object.entries(origin.localStorage)) {
						localStorage.setItem(key, value as string);
					}
				});
			}
		}
	} catch (error) {
		console.warn('Could not load auth state:', error);
	}
};

export const getUserIdFromAuth = (authFilePath: string): string | undefined => {
	try {
		const authData: { cookies: Array<{ name: string; value: string }> } = JSON.parse(
			readFileSync(authFilePath, 'utf-8')
		);

		// Find the __session cookie which contains the JWT
		const sessionCookie = authData.cookies?.find((cookie) => cookie.name === '__session');
		if (!sessionCookie?.value) {
			return undefined;
		}

		// Decode JWT payload (simple base64 decode, no verification needed for tests)
		const jwtParts = sessionCookie.value.split('.');
		if (jwtParts.length !== 3) {
			return undefined;
		}

		const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
		return payload.sub; // 'sub' field contains the user ID
	} catch {
		return undefined;
	}
};
