import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNotificationsLogic } from '$lib/server/remotes/notifications';
import * as notificationService from '$lib/server/services/notificationService';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('$lib/server/services/notificationService', () => ({
	getNotifications: vi.fn()
}));

describe('Notifications Remote Function', () => {
	let mockEvent: RequestEvent;

	beforeEach(() => {
		vi.resetAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mockEvent = {
			locals: {
				auth: vi.fn().mockReturnValue({ userId: 'user-123' })
			}
		} as unknown as RequestEvent;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return notifications for authenticated user', async () => {
		const mockNotifications = [{ id: '1', title: 'Test' }];
		vi.mocked(notificationService.getNotifications).mockResolvedValue(mockNotifications as any);

		const result = await getNotificationsLogic(mockEvent);

		expect(result).toEqual(mockNotifications);
		expect(notificationService.getNotifications).toHaveBeenCalledWith('user-123', { unreadOnly: true });
	});

	it('should throw error if user is not authenticated', async () => {
		mockEvent.locals.auth = vi.fn().mockReturnValue({ userId: null });

		await expect(getNotificationsLogic(mockEvent)).rejects.toThrow('Unauthorized');
	});

	it('should throw error if service fails', async () => {
		vi.mocked(notificationService.getNotifications).mockRejectedValue(new Error('Service error'));

		await expect(getNotificationsLogic(mockEvent)).rejects.toThrow('Failed to fetch notifications');
	});
});
