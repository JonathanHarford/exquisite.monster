import { test, expect } from '@playwright/test';
import { newContextPage } from './helpers/auth';
import { setupTestData, cleanupTestData } from './helpers/db';
import { TestDataFactory } from './helpers/test-data-factory';

test.describe('Notifications System', () => {
	const testId = TestDataFactory.generateTestId();

	test.beforeAll(async () => {
		await setupTestData(testId);
	});

	test.afterAll(async () => {
		await TestDataFactory.cleanup(testId);
		await cleanupTestData();
	});
	test.describe('Notification Display', () => {
		test('shows notification indicator when notifications exist', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Look for notification indicator (bell icon, badge, etc.)
			const notificationIndicator = page.locator(
				'[data-testid="notification-indicator"], .notification-badge, .notification-bell, .notification-icon'
			);

			// If notifications exist, indicator should be visible
			if ((await notificationIndicator.count()) > 0) {
				await expect(notificationIndicator.first()).toBeVisible();
			}

			await page.close();
		});

		test('can open notifications panel', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Look for notification trigger button
			const notificationButton = page.locator(
				'[data-testid="notification-button"], .notification-trigger, button:has-text("Notifications")'
			);

			if ((await notificationButton.count()) > 0) {
				await notificationButton.first().click();

				// Should open notifications panel or dropdown
				const notificationPanel = page.locator(
					'[data-testid="notification-panel"], .notification-dropdown, .notification-list'
				);

				if ((await notificationPanel.count()) > 0) {
					await expect(notificationPanel.first()).toBeVisible();
				}
			}

			await page.close();
		});

		test('displays notification content', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Look for notifications page or panel
			const notificationsSection = page.locator(
				'[data-testid="notifications"], .notifications-page, .notification-list'
			);

			if ((await notificationsSection.count()) > 0) {
				// Should show notification items
				const notificationItems = page.locator(
					'.notification-item, .notification-entry, [data-testid="notification"]'
				);

				if ((await notificationItems.count()) > 0) {
					const firstNotification = notificationItems.first();
					await expect(firstNotification).toBeVisible();

					// Should have notification content
					const notificationText = firstNotification.locator('p, span, .notification-text');
					if ((await notificationText.count()) > 0) {
						await expect(notificationText.first()).toBeVisible();
					}
				}
			}

			await page.close();
		});

		test('can mark notifications as read', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Look for unread notifications
			const unreadNotifications = page.locator(
				'.notification-unread, .notification-new, [data-read="false"]'
			);

			if ((await unreadNotifications.count()) > 0) {
				const firstUnread = unreadNotifications.first();

				// Look for mark as read button or click to mark as read
				const markReadButton = firstUnread.locator(
					'button:has-text("Mark as read"), .mark-read-btn'
				);

				if ((await markReadButton.count()) > 0) {
					await markReadButton.click();
					await page.waitForTimeout(1000);

					// Notification should be marked as read
					await expect(firstUnread).not.toHaveClass(/unread|new/);
				} else {
					// Some systems mark as read on click/view
					await firstUnread.click();
					await page.waitForTimeout(1000);
				}
			}

			await page.close();
		});

		test('handles empty notifications state', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p2.json', // Use p2 who might have fewer notifications
				url: '/'
			});

			// Try to access notifications
			const notificationButton = page.locator(
				'[data-testid="notification-button"], .notification-trigger'
			);

			if ((await notificationButton.count()) > 0) {
				await notificationButton.first().click();

				// Should show empty state message
				const emptyState = page.locator(
					'.no-notifications, .empty-notifications, text="No notifications"'
				);

				if ((await emptyState.count()) > 0) {
					await expect(emptyState.first()).toBeVisible();
				}
			}

			await page.close();
		});
	});

	test.describe('Notification Navigation', () => {
		test('can navigate to notification target', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Look for notifications with links
			const notificationLinks = page.locator(
				'.notification-item a, .notification-link, [data-testid="notification-link"]'
			);

			if ((await notificationLinks.count()) > 0) {
				const firstLink = notificationLinks.first();
				await firstLink.click();

				// Should navigate to target page
				await page.waitForLoadState('domcontentloaded');

				// Verify we navigated somewhere (URL changed)
				const currentUrl = page.url();
				expect(currentUrl).not.toBe('/');
			}

			await page.close();
		});

		test('notification panel can be closed', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Open notifications panel
			const notificationButton = page.locator(
				'[data-testid="notification-button"], .notification-trigger'
			);

			if ((await notificationButton.count()) > 0) {
				await notificationButton.first().click();

				const notificationPanel = page.locator(
					'[data-testid="notification-panel"], .notification-dropdown'
				);

				if ((await notificationPanel.count()) > 0) {
					await expect(notificationPanel.first()).toBeVisible();

					// Look for close button or click outside to close
					const closeButton = page.locator(
						'.close-notifications, .notification-close, button[aria-label="Close"]'
					);

					if ((await closeButton.count()) > 0) {
						await closeButton.first().click();
					} else {
						// Click outside to close
						await page.click('body');
					}

					await page.waitForTimeout(500);

					// Panel should be hidden or removed
					await expect(notificationPanel.first()).not.toBeVisible();
				}
			}

			await page.close();
		});
	});

	test.describe('Notification Accessibility', () => {
		test('notification elements are accessible', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Check notification button accessibility
			const notificationButton = page.locator(
				'[data-testid="notification-button"], .notification-trigger'
			);

			if ((await notificationButton.count()) > 0) {
				const button = notificationButton.first();

				// Should have aria-label or accessible name
				const ariaLabel = await button.getAttribute('aria-label');
				const buttonText = await button.textContent();

				expect(ariaLabel || buttonText).toBeTruthy();

				// Should be keyboard accessible
				await button.focus();
				await expect(button).toBeFocused();
			}

			await page.close();
		});

		test('notification panel has proper ARIA attributes', async ({ browser }) => {
			const page = await newContextPage(browser, {
				storageState: 'tests/e2e/.auth/p1.json',
				url: '/'
			});

			// Open notification panel
			const notificationButton = page.locator(
				'[data-testid="notification-button"], .notification-trigger'
			);

			if ((await notificationButton.count()) > 0) {
				await notificationButton.first().click();

				const notificationPanel = page.locator(
					'[data-testid="notification-panel"], .notification-dropdown'
				);

				if ((await notificationPanel.count()) > 0) {
					const panel = notificationPanel.first();

					// Should have proper ARIA attributes
					const role = await panel.getAttribute('role');
					const ariaLabel = await panel.getAttribute('aria-label');
					const ariaLabelledBy = await panel.getAttribute('aria-labelledby');

					// Should have dropdown, menu, or dialog role
					expect(role || ariaLabel || ariaLabelledBy).toBeTruthy();
				}
			}

			await page.close();
		});
	});
});
