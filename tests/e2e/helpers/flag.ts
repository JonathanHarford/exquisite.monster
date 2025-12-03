import { expect, type Page } from '@playwright/test';
import { assertNoTimer, assertTimer } from './play';

export const flagTurn = async (
	page: Page,
	reason: 'offensive' | 'spam' | 'other',
	explanation: string = 'Test flag reason'
) => {
	await page.waitForLoadState('domcontentloaded');
	console.log('🧪 flagTurn', reason);
	await assertTimer(page);

	// Click the Report button to open the modal
	await page.locator('.report-link button:has-text("Report?")').click();

	// Wait for the modal to appear
	await page.waitForSelector('div[role="dialog"]');

	// Fill and submit the flag form in the modal
	await page.locator('select[name="reason"]').selectOption(reason);
	await page.locator('textarea[name="explanation"]').fill(explanation);
	await page.getByRole('button', { name: 'Submit Report' }).click();

	// Wait for redirect to home page with success message
	await page.waitForURL('/?flagSuccess=true');

	// Verify success modal is shown
	await expect(page.getByText('Thank you for your report')).toBeVisible();

	// Close the success modal
	await page.getByRole('button', { name: 'OK' }).click();
	await assertNoTimer(page);
};
