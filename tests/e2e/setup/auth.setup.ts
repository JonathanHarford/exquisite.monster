import { test as setup, type Browser, type Page } from '@playwright/test';
import { clerkSetup, clerk } from '@clerk/testing/playwright';

const authUser = async (
	page: Page,
	identifier: string,
	password: string,
	username: string
) => {
	// Navigate to homepage first and wait for Clerk handshake to complete
	await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });

	// Use Clerk's testing helper to sign in
	await clerk.signIn({
		page,
		signInParams: {
			strategy: 'password',
			identifier,
			password
		}
	});

	// Save the authenticated session state
	const storagePath = `tests/e2e/.auth/${username}.json`;
	await page.context().storageState({ path: storagePath });

	return page;
};

const authAdmin = async (browser: Browser) => {
	const identifier = process.env.ADMIN_EMAIL || "example@example.com";
	const context = await browser.newContext();
	const page = await context.newPage();

	await authUser(page, identifier, 'epycepyc', 'admin');
	await page.close();
	await context.close();
};

const authPlayer = async (browser: Browser, ix: number) => {
	const identifier = `p${ix}@p.com`;
	const context = await browser.newContext();
	const page = await context.newPage();

	await authUser(page, identifier, 'epycepyc', `p${ix}`);
	await page.close();
	await context.close();
};

setup('authenticate users', async ({ browser }) => {
	await clerkSetup({
		publishableKey: process.env.PUBLIC_CLERK_PUBLISHABLE_KEY,
		secretKey: process.env.CLERK_SECRET_KEY
	});

	await Promise.all([
		authPlayer(browser, 1),
		authPlayer(browser, 2),
		authPlayer(browser, 3),
		authPlayer(browser, 4),
		authAdmin(browser)
	]);
});
