import { expect, type Page } from '@playwright/test';

const navs = {
	notifications: 'Notifications',
	account: 'Account',
	admin: 'Admin',
	logout: 'Sign Out'
};

export const openAvatarMenu = async (page: Page, nav?: keyof typeof navs) => {
	await page.getByRole('button', { name: 'Open Avatar Menu' }).click();
	if (nav) {
		await page.getByRole('link', { name: nav }).click();
	}
};
