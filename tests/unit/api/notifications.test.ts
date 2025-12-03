import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../../src/routes/api/notifications/+server'; // Adjust path as needed
import * as notificationService from '$lib/server/services/notificationService';

vi.mock('$lib/server/services/notificationService');

interface MockRequestEvent {
	locals: {
		auth: ReturnType<typeof vi.fn>;
		security: Record<string, never>;
	};
	request: {
		headers: {
			get: ReturnType<typeof vi.fn>;
		};
	};
}

describe('/api/notifications GET endpoint', () => {
	let mockRequestEvent: MockRequestEvent;

	beforeEach(() => {
		vi.resetAllMocks();
		mockRequestEvent = {
			locals: {
				auth: vi.fn().mockReturnValue({ userId: 'test-user-id' }), // Mock Clerk's auth function on locals
				security: {} // Mock security object
			},
			request: {
				headers: {
					get: vi.fn().mockReturnValue(null) // Mock request headers
				}
			}
		};
	});

	it('should return 401 if user is not authenticated', async () => {
		mockRequestEvent.locals.auth = vi.fn().mockReturnValue({ userId: null }); // Simulate no authenticated user
		try {
			await GET(mockRequestEvent as any);
			expect.fail('Expected GET to throw an error');
		} catch (e: unknown) {
			// Type guard to check if the error has the expected properties
			if (e && typeof e === 'object' && 'status' in e && 'body' in e) {
				const error = e as { status: number; body: { message: string } };
				expect(error.status).toBe(401);
				expect(error.body.message).toBe('Unauthorized');
			} else {
				throw new Error('Unexpected error format');
			}
		}
	});

	it('should return notifications for an authenticated user', async () => {
		const mockNotifications = [
			{ id: '1', text: 'Notification 1', read: false, userId: 'test-user-id' },
			{ id: '2', text: 'Notification 2', read: false, userId: 'test-user-id' }
		];
		// @ts-expect-error - allow mocking
		notificationService.getNotifications = vi.fn().mockResolvedValue(mockNotifications);

		const response = await GET(mockRequestEvent as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual(mockNotifications);
		expect(notificationService.getNotifications).toHaveBeenCalledWith('test-user-id', {
			unreadOnly: true
		});
	});

	it('should return an empty array if there are no unread notifications', async () => {
		// @ts-expect-error - allow mocking
		notificationService.getNotifications = vi.fn().mockResolvedValue([]);

		const response = await GET(mockRequestEvent as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([]);
		expect(notificationService.getNotifications).toHaveBeenCalledWith('test-user-id', {
			unreadOnly: true
		});
	});

	it('should return 500 if notification service throws an error', async () => {
		// @ts-expect-error - allow mocking
		notificationService.getNotifications = vi.fn().mockRejectedValue(new Error('Service error'));
		try {
			await GET(mockRequestEvent as any);
			expect.fail('Expected GET to throw an error');
		} catch (e: unknown) {
			// Type guard to check if the error has the expected properties
			if (e && typeof e === 'object' && 'status' in e && 'body' in e) {
				const error = e as { status: number; body: { message: string } };
				expect(error.status).toBe(500);
				expect(error.body.message).toBe('Failed to fetch notifications');
			} else {
				throw new Error('Unexpected error format');
			}
		}
		expect(notificationService.getNotifications).toHaveBeenCalledWith('test-user-id', {
			unreadOnly: true
		});
	});
});
