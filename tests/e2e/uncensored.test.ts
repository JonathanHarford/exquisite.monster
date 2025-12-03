import { test, expect, type Page } from '@playwright/test';
import { newContextPage, getUserIdFromAuth } from './helpers/auth.js';
import { TEST_PLAYER_BIRTHDAY_ADULT, TEST_PLAYER_BIRTHDAY_MINOR } from './helpers/constants.js';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';
import { prisma } from './helpers/prisma';

const storageState = 'tests/e2e/.auth/p2.json';

const cleanupPendingPartyTurns = async () => {
	const userId = getUserIdFromAuth(storageState);
	if (!userId) return;

	// Clean up any pending party turns for this test user to ensure clean state
	// Pending turns have completedAt: null
	try {
		await prisma.turn.deleteMany({
			where: {
				playerId: userId,
				completedAt: null, // Pending turns have null completedAt
				game: {
					seasonId: { not: null } // Only party games (have seasonId)
				}
			}
		});

		// Also clean up any party memberships for this user
		await prisma.playersInSeasons.deleteMany({
			where: {
				playerId: userId
			}
		});

		console.log(`Cleaned up party data for user: ${userId}`);
	} catch (error) {
		console.error('Failed to cleanup party data:', error);
	}
};

const resetPlayerProfile = async () => {
	const userId = getUserIdFromAuth(storageState);
	if (!userId) return;

	// Reset the p2 user's profile to default adult state for test isolation
	try {
		await prisma.player.update({
			where: { id: userId },
			data: {
				birthday: new Date('1990-01-01'), // Adult birthday
				hideLewdContent: true // Default to hiding lewd content
			}
		});
		console.log(`Reset profile for user: ${userId}`);
	} catch (error) {
		console.error('Failed to reset profile:', error);
	}
};

const getLewdToggle = async (page: Page) => {
	const lewdToggle = page.getByRole('checkbox', { name: 'Hide lewd content (18+ only)' });
	await expect(lewdToggle).toHaveCount(1);
	return lewdToggle;
};

const toggleAccountLewdHide = async (page: Page, hide: boolean) => {
	const lewdToggle = await getLewdToggle(page);
	const isChecked = await lewdToggle.isChecked();

	// No need to toggle if it's already in the desired state
	if ((hide && isChecked) || (!hide && !isChecked)) {
		return;
	}

	await lewdToggle.click({ force: true });

	// Wait a bit for the onchange to trigger
	await page.waitForTimeout(200);

	// Check if form was submitted automatically, if not submit manually
	const isStillSameState = await lewdToggle.isChecked();
	if ((hide && !isStillSameState) || (!hide && isStillSameState)) {
		// Auto-submit didn't work, click save manually
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await page.waitForTimeout(1000); // Wait for manual submission
	}

	// After the toggle, assert the new state
	if (hide) {
		await expect(lewdToggle).toBeChecked();
	} else {
		await expect(lewdToggle).not.toBeChecked();
	}
};

const makeMinor = async (page: Page, birthday = TEST_PLAYER_BIRTHDAY_MINOR) => {
	const lewdToggle = await getLewdToggle(page);
	console.log(
		'makeMinor: before setting birthday, lewdToggle enabled:',
		await lewdToggle.isEnabled()
	);
	console.log('setting birthday:', birthday);
	await page.getByRole('textbox', { name: 'Birthday' }).fill(birthday);

	await page.getByRole('button', { name: 'Save Changes' }).click();

	// Wait for the toggle to become disabled instead of waiting for HTTP response
	await expect(lewdToggle).toBeDisabled({ timeout: 10000 });

	console.log(
		'makeMinor: after setting birthday, lewdToggle enabled:',
		await lewdToggle.isEnabled()
	);
};

const makeAdult = async (page: Page) => {
	const lewdToggle = await getLewdToggle(page);
	console.log(
		'makeAdult: before setting birthday, lewdToggle enabled:',
		await lewdToggle.isEnabled()
	);
	console.log('setting birthday to', TEST_PLAYER_BIRTHDAY_ADULT);
	await page.getByRole('textbox', { name: 'Birthday' }).fill(TEST_PLAYER_BIRTHDAY_ADULT);

	await page.getByRole('button', { name: 'Save Changes' }).click();

	// Wait for the toggle to become enabled instead of waiting for HTTP response
	await expect(lewdToggle).toBeEnabled({ timeout: 10000 });
	await expect(lewdToggle).toBeChecked();

	console.log(
		'makeAdult: after setting birthday, lewdToggle enabled:',
		await lewdToggle.isEnabled()
	);
};

const shouldSeeOnlyOnePlayButton = async (page: Page) => {
	// Navigate to play page - handle different CtaButton states
	const playLink = page
		.locator(
			'nav a[href="/play"], nav a[href*="/play/"], nav a:has-text("Play"), nav a:has-text("waiting!")'
		)
		.first();
	await expect(playLink).toBeVisible({ timeout: 10000 });
	await playLink.click({ force: true });
	const playButtons = page.getByRole('button', { name: 'Play' });
	await expect(playButtons).toHaveCount(1);
};

const shouldSeeTwoPlayButtons = async (page: Page) => {
	// Navigate to play page - handle different CtaButton states
	const playLink = page
		.locator(
			'nav a[href="/play"], nav a[href*="/play/"], nav a:has-text("Play"), nav a:has-text("waiting!")'
		)
		.first();
	await expect(playLink).toBeVisible({ timeout: 10000 });
	await playLink.click({ force: true });

	// Wait for page to load and buttons to appear
	await page.waitForLoadState('networkidle');

	const playButton = page.getByRole('button', { name: 'Play', exact: true });
	await expect(playButton).toBeVisible({ timeout: 10000 });

	// Expand "Let me choose!" to see the 18+ buttons
	const letMeChoose = page.locator('summary:has-text("Let me choose!")');
	await expect(letMeChoose).toBeVisible({ timeout: 10000 });
	await letMeChoose.click();

	// Now check for Play 18+ buttons inside the expanded details
	const play18Button = page.getByRole('button', { name: 'Play 18+' }).first();
	await expect(play18Button).toBeVisible({ timeout: 10000 });
};

const shouldSeeNoLewdCheckbox = async (page: Page) => {
	const exploreLink = page.locator('nav a[href="/g"], nav a:has-text("Gallery")').first();
	await expect(exploreLink).toBeVisible({ timeout: 10000 });
	await exploreLink.click();
	const lewdCheckboxGallery = page.getByRole('checkbox', { name: 'Include lewd?' }).first();
	await expect(lewdCheckboxGallery).toBeHidden();
};

const _shouldSeeLewdCheckbox = async (page: Page) => {
	const exploreLink = page.locator('nav a[href="/g"], nav a:has-text("Gallery")').first();
	await expect(exploreLink).toBeVisible({ timeout: 10000 });
	await exploreLink.click();
	const lewdCheckboxGallery = page.getByRole('checkbox', { name: 'Include lewd?' }).first();
	await expect(lewdCheckboxGallery).toBeVisible();
};

const shouldSeeGames = async (page: Page) => {
	// Wait for page to fully load
	await page.waitForLoadState('domcontentloaded');

	const games = page.locator('.game-card');
	await expect(games).toHaveCount(5);
};

const _toggleLewdGallery = async (page: Page, include: boolean) => {
	const lewdCheckbox = page.getByRole('checkbox', { name: 'Include lewd?' }).first();
	await page.locator('label', { hasText: 'Include lewd?' }).first().click(); // check/uncheck flaky with Toggle?
	if (include) {
		await expect(lewdCheckbox).toBeChecked();
	} else {
		await expect(lewdCheckbox).not.toBeChecked();
	}
};

test.describe('Uncensored view feature', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});

	test.beforeEach(async () => {
		await cleanupPendingPartyTurns();
		await resetPlayerProfile();
	});
	test('minor player', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/',
			storageState: storageState
		});

		// Set up minor player with birthday under 18
		await page.goto('/account');
		await makeMinor(page);
		await shouldSeeOnlyOnePlayButton(page);
		await shouldSeeNoLewdCheckbox(page);
		await page.close();
	});

	test('birthdayless player', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/',
			storageState: storageState
		});

		// Set up birthdayless player
		await page.goto('/account');
		await makeMinor(page, '');
		await shouldSeeOnlyOnePlayButton(page);
		await shouldSeeNoLewdCheckbox(page);
		await page.close();
	});

	test('adult player hiding lewd content', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/',
			storageState: storageState
		});

		await page.goto('/account');
		await makeMinor(page);
		await makeAdult(page);

		await shouldSeeOnlyOnePlayButton(page);
		await shouldSeeNoLewdCheckbox(page);

		await page.close();
	});

	test('adult player not hiding lewd content', async ({ browser }) => {
		const page = await newContextPage(browser, {
			url: '/',
			storageState: storageState
		});

		await page.goto('/account');
		await makeMinor(page);
		await makeAdult(page);
		await toggleAccountLewdHide(page, false);

		await shouldSeeTwoPlayButtons(page);
		await page.close();
	});

	test('game gallery shows all games when adult user has lewd content enabled', async ({
		browser
	}) => {
		const page = await newContextPage(browser, {
			url: '/',
			storageState: storageState
		});

		await page.goto('/account');
		await makeMinor(page);
		await makeAdult(page);
		await toggleAccountLewdHide(page, false);

		const exploreLink = page.locator('nav a[href="/g"], nav a:has-text("Gallery")').first();
		await expect(exploreLink).toBeVisible({ timeout: 10000 });
		await exploreLink.click();
		await shouldSeeGames(page);

		await page.close();
	});
});
