import { describe, it, expect } from 'vitest';

// Mock notification type for testing
interface TestNotification {
	title: string;
	body: string;
}

// Copy of the font size calculation function from the component
function getNotificationFontSize(notification: TestNotification): string {
	const titleLength = notification.title.length;
	const bodyLength = notification.body.length;
	const totalLength = titleLength + bodyLength;

	// Base font sizes
	const baseTitleSize = 1.125; // text-lg equivalent (18px)
	const baseBodySize = 1; // text-base equivalent (16px)

	// Calculate scaling factor based on total content length
	let scaleFactor = 1;
	if (totalLength > 200) {
		scaleFactor = Math.max(0.75, 1 - (totalLength - 200) / 800); // Scale down to min 75%
	}

	return `
		--notification-title-size: ${baseTitleSize * scaleFactor}rem;
		--notification-body-size: ${baseBodySize * scaleFactor}rem;
	`;
}

describe('Notification Font Size Calculation', () => {
	it('should return full size for short notifications', () => {
		const shortNotification: TestNotification = {
			title: 'Short title',
			body: 'Short body text'
		};

		const result = getNotificationFontSize(shortNotification);
		expect(result).toContain('--notification-title-size: 1.125rem');
		expect(result).toContain('--notification-body-size: 1rem');
	});

	it('should scale down font size for long notifications', () => {
		const longNotification: TestNotification = {
			title: 'This is a very long notification title that goes on and on',
			body: 'This is a very long notification body that contains a lot of text and details about something important that happened in the system and needs to be communicated to the user in a comprehensive way'
		};

		const result = getNotificationFontSize(longNotification);
		// Should be scaled down from the base sizes
		const titleMatch = result.match(/--notification-title-size: ([\d.]+)rem/);
		const bodyMatch = result.match(/--notification-body-size: ([\d.]+)rem/);

		expect(titleMatch).toBeTruthy();
		expect(bodyMatch).toBeTruthy();

		const titleSize = parseFloat(titleMatch![1]);
		const bodySize = parseFloat(bodyMatch![1]);

		expect(titleSize).toBeLessThan(1.125); // Should be less than base title size
		expect(bodySize).toBeLessThan(1); // Should be less than base body size
	});

	it('should not scale below 75% of original size', () => {
		const veryLongNotification: TestNotification = {
			title:
				'This is an extremely long notification title that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on',
			body: 'This is an extremely long notification body that contains an enormous amount of text and details about something very important that happened in the system and needs to be communicated to the user in a very comprehensive way with lots of details and explanations and context and background information and additional notes and references and links and more information that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on'
		};

		const result = getNotificationFontSize(veryLongNotification);
		// Should be at minimum 75% of original size
		const titleMatch = result.match(/--notification-title-size: ([\d.]+)rem/);
		const bodyMatch = result.match(/--notification-body-size: ([\d.]+)rem/);

		expect(titleMatch).toBeTruthy();
		expect(bodyMatch).toBeTruthy();

		const titleSize = parseFloat(titleMatch![1]);
		const bodySize = parseFloat(bodyMatch![1]);

		expect(titleSize).toBeGreaterThanOrEqual(1.125 * 0.75); // At least 75% of 1.125rem
		expect(bodySize).toBeGreaterThanOrEqual(1 * 0.75); // At least 75% of 1rem
	});

	it('should handle edge case of exactly 200 characters', () => {
		const exactNotification: TestNotification = {
			title: 'A'.repeat(100),
			body: 'B'.repeat(100)
		};

		const result = getNotificationFontSize(exactNotification);
		// Should still be full size at exactly 200 characters
		expect(result).toContain('--notification-title-size: 1.125rem');
		expect(result).toContain('--notification-body-size: 1rem');
	});

	it('should start scaling at 201 characters', () => {
		const justOverNotification: TestNotification = {
			title: 'A'.repeat(100),
			body: 'B'.repeat(101)
		};

		const result = getNotificationFontSize(justOverNotification);
		// Should be slightly scaled down
		const titleMatch = result.match(/--notification-title-size: ([\d.]+)rem/);
		const bodyMatch = result.match(/--notification-body-size: ([\d.]+)rem/);

		expect(titleMatch).toBeTruthy();
		expect(bodyMatch).toBeTruthy();

		const titleSize = parseFloat(titleMatch![1]);
		const bodySize = parseFloat(bodyMatch![1]);

		expect(titleSize).toBeLessThan(1.125);
		expect(bodySize).toBeLessThan(1);
	});
});
