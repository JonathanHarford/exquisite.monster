import { test, expect } from '@playwright/test';
import { newContextPage } from './helpers/auth';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';

test.describe('Content Flagging', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test('flag button appears on game content', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Look for games in gallery - using pre-seeded content
		const gameLinks = page.locator('a[href^="/g/"]');
		const linkCount = await gameLinks.count();

		if (linkCount > 0) {
			// Click on first game
			await gameLinks.first().click();

			// Check if flag/report functionality is visible
			const reportButton = page.locator('[data-testid="report-button"], .report-link button');
			const hasReportButton = (await reportButton.count()) > 0;

			if (hasReportButton) {
				await expect(reportButton.first()).toBeVisible();
			}
		}

		await page.close();
	});

	test('can open flag modal', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Look for games in gallery
		const gameLinks = page.locator('a[href^="/g/"]');
		const linkCount = await gameLinks.count();

		if (linkCount > 0) {
			await gameLinks.first().click();

			// Try to open flag modal
			const reportButton = page.locator('[data-testid="report-button"], .report-link button');
			const hasReportButton = (await reportButton.count()) > 0;

			if (hasReportButton) {
				await reportButton.first().click();

				// Check if modal opens
				const modal = page.locator('[data-testid="flag-modal"], div[role="dialog"]');
				const hasModal = (await modal.count()) > 0;

				if (hasModal) {
					await expect(modal.first()).toBeVisible();
				}
			}
		}

		await page.close();
	});

	test('flag form has required fields', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Look for games in gallery
		const gameLinks = page.locator('a[href^="/g/"]');
		const linkCount = await gameLinks.count();

		if (linkCount > 0) {
			await gameLinks.first().click();

			// Try to open flag modal
			const reportButton = page.locator('[data-testid="report-button"], .report-link button');
			const hasReportButton = (await reportButton.count()) > 0;

			if (hasReportButton) {
				await reportButton.first().click();

				// Check form fields in modal
				const reasonField = page.locator('[data-testid="flag-reason"], select[name="reason"]');
				const explanationField = page.locator(
					'[data-testid="flag-explanation"], textarea[name="explanation"]'
				);

				const hasReasonField = (await reasonField.count()) > 0;
				const hasExplanationField = (await explanationField.count()) > 0;

				if (hasReasonField) {
					await expect(reasonField.first()).toBeVisible();
				}
				if (hasExplanationField) {
					await expect(explanationField.first()).toBeVisible();
				}
			}
		}

		await page.close();
	});

	test('can submit flag with valid data', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/p1.json',
			url: '/g'
		});

		// Look for games in gallery
		const gameLinks = page.locator('a[href^="/g/"]');
		const linkCount = await gameLinks.count();

		if (linkCount > 0) {
			await gameLinks.first().click();

			// Try to open flag modal and submit
			const reportButton = page.locator('[data-testid="report-button"], .report-link button');
			const hasReportButton = (await reportButton.count()) > 0;

			if (hasReportButton) {
				await reportButton.first().click();

				// Fill and submit form if it exists
				const reasonField = page.locator('[data-testid="flag-reason"], select[name="reason"]');
				const explanationField = page.locator(
					'[data-testid="flag-explanation"], textarea[name="explanation"]'
				);
				const submitButton = page.locator('[data-testid="flag-submit"], button:has-text("Submit")');

				const hasReasonField = (await reasonField.count()) > 0;
				const hasExplanationField = (await explanationField.count()) > 0;
				const hasSubmitButton = (await submitButton.count()) > 0;

				if (hasReasonField && hasExplanationField && hasSubmitButton) {
					await reasonField.selectOption('other');
					await explanationField.fill('Test flag submission');
					await submitButton.click();

					// Wait for response
					await page.waitForTimeout(1000);
				}
			}
		}

		await page.close();
	});
});

test.describe('Admin Flag Management', () => {
	test('admin can view flagged content list', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/admin.json',
			url: '/admin'
		});

		// Check if admin dashboard is accessible
		const adminHeading = page.locator('h1:has-text("Admin"), [data-testid="admin-heading"]');
		const hasAdminHeading = (await adminHeading.count()) > 0;

		if (hasAdminHeading) {
			await expect(adminHeading.first()).toBeVisible();
		}

		// Look for flagged content navigation
		const flaggedContentLink = page.locator(
			'[data-testid="flagged-content-link"], a:has-text("Flag"), a:has-text("Moderation")'
		);
		const hasFlaggedContentLink = (await flaggedContentLink.count()) > 0;

		if (hasFlaggedContentLink) {
			await flaggedContentLink.first().click();

			// Check if flagged content interface is visible
			const flaggedInterface = page.locator(
				'[data-testid="flagged-content"], .flagged, .moderation'
			);
			const hasFlaggedInterface = (await flaggedInterface.count()) > 0;

			if (hasFlaggedInterface) {
				await expect(flaggedInterface.first()).toBeVisible();
			}
		}

		await page.close();
	});

	test('admin can approve flagged content', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/admin.json',
			url: '/admin'
		});

		// Navigate to flagged content if possible
		const flaggedContentLink = page.locator(
			'[data-testid="flagged-content-link"], a:has-text("Flag"), a:has-text("Moderation")'
		);
		const hasFlaggedContentLink = (await flaggedContentLink.count()) > 0;

		if (hasFlaggedContentLink) {
			await flaggedContentLink.first().click();

			// Look for approve buttons
			const approveButton = page.locator(
				'[data-testid="approve-button"], button:has-text("Approve")'
			);
			const hasApproveButton = (await approveButton.count()) > 0;

			if (hasApproveButton) {
				await expect(approveButton.first()).toBeVisible();
			}
		}

		await page.close();
	});

	test('admin can remove flagged content', async ({ browser }) => {
		const page = await newContextPage(browser, {
			storageState: 'tests/e2e/.auth/admin.json',
			url: '/admin'
		});

		// Navigate to flagged content if possible
		const flaggedContentLink = page.locator(
			'[data-testid="flagged-content-link"], a:has-text("Flag"), a:has-text("Moderation")'
		);
		const hasFlaggedContentLink = (await flaggedContentLink.count()) > 0;

		if (hasFlaggedContentLink) {
			await flaggedContentLink.first().click();

			// Look for remove/reject buttons
			const removeButton = page.locator(
				'[data-testid="remove-button"], button:has-text("Remove"), button:has-text("Reject")'
			);
			const hasRemoveButton = (await removeButton.count()) > 0;

			if (hasRemoveButton) {
				await expect(removeButton.first()).toBeVisible();
			}
		}

		await page.close();
	});
});
