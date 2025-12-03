import { expect, type Page } from '@playwright/test';

export const viewGame = async (page: Page, gameId: string) => {
	console.log('🧪 viewGame', gameId);
	await page.goto(`/g/${gameId}`);
	await page.waitForURL(`/g/${gameId}`);
};

export const confirmTurnFlag = async (page: Page, turnIdx: number) => {
	console.log('🧪 reject turn');
	const turn = page.locator('.turn').nth(turnIdx);

	// Admin can see the flagged turn in context
	await expect(turn).toHaveClass(/flagged-turn/);

	// Admin rejects the turn
	await turn.getByRole('button', { name: 'Confirm Flag' }).click();

	// Admin can still see the rejected turn
	await expect(turn).toHaveClass(/rejected-turn/);
};

export const rejectTurnFlag = async (page: Page, turnIdx: number) => {
	console.log('🧪 allow turn');
	const turn = page.locator('.turn').nth(turnIdx);
	// Admin can see the flagged turn in context
	await expect(turn).toHaveClass(/flagged-turn/);

	// Admin allows the turn
	await page.getByRole('button', { name: 'Reject Flag' }).click();

	// Admin can still see the turn (no longer flagged)
	await expect(turn).not.toHaveClass(/flagged-turn/);
};
