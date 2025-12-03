import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clerkClient } from 'svelte-clerk/server';
import type { RequestEvent } from '@sveltejs/kit';
import type { Player } from '$lib/types/domain';
import { uploadProfilePicture } from '$lib/server/storage';
import { updatePlayer } from '$lib/server/services/playerService';
import { logger } from '$lib/server/logger';
import { actions } from '../../src/routes/account/+page.server';
import { fail } from '@sveltejs/kit';

// Mock dependencies
vi.mock('svelte-clerk/server', () => ({
	clerkClient: {
		users: {
			updateUserProfileImage: vi.fn()
		}
	}
}));
vi.mock('$lib/server/storage', () => ({
	uploadProfilePicture: vi.fn()
}));
vi.mock('$lib/server/services/playerService', () => ({
	updatePlayer: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn()
	}
}));
vi.mock('@sveltejs/kit', async () => {
	const actual = await vi.importActual('@sveltejs/kit');
	return {
		...actual,
		fail: vi.fn()
	};
});

describe('Profile Picture Synchronization', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should sync profile picture with Clerk when upload succeeds', async () => {
		// Arrange
		vi.mocked(uploadProfilePicture).mockResolvedValue({
			path: '/img/profiles/user123-1234567890.jpg'
		});
		vi.mocked(updatePlayer).mockResolvedValue({} as Player);
		vi.mocked(clerkClient.users.updateUserProfileImage).mockResolvedValue({
			id: 'user123'
		} as any);

		const mockFile = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });
		const formData = new FormData();
		formData.append('file', mockFile);

		const mockEvent: Partial<RequestEvent> = {
			request: { formData: () => Promise.resolve(formData) } as any,
			locals: { auth: () => ({ userId: 'user123' }) } as any,
			url: { origin: 'http://localhost:3793' } as URL
		};

		// Act
		const result = await actions.uploadProfilePicture(mockEvent as any);

		// Assert
		expect(uploadProfilePicture).toHaveBeenCalledWith(mockFile, 'user123');
		expect(updatePlayer).toHaveBeenCalledWith('user123', {
			imageUrl: '/img/profiles/user123-1234567890.jpg'
		});
		expect(clerkClient.users.updateUserProfileImage).toHaveBeenCalledWith('user123', {
			file: expect.any(File)
		});
		expect(result).toEqual({
			success: true,
			path: '/img/profiles/user123-1234567890.jpg'
		});
		expect(logger.info).toHaveBeenCalledWith(
			'Profile picture uploaded for user user123: /img/profiles/user123-1234567890.jpg'
		);
		expect(logger.info).toHaveBeenCalledWith('Profile picture synced with Clerk for user user123');
	});

	it('should handle Clerk sync failure gracefully', async () => {
		// Arrange
		vi.mocked(uploadProfilePicture).mockResolvedValue({
			path: '/img/profiles/user123-1234567890.jpg'
		});
		vi.mocked(updatePlayer).mockResolvedValue({} as Player);
		vi.mocked(clerkClient.users.updateUserProfileImage).mockRejectedValue(
			new Error('Clerk API error')
		);

		const mockFile = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });
		const formData = new FormData();
		formData.append('file', mockFile);

		const mockEvent: Partial<RequestEvent> = {
			request: { formData: () => Promise.resolve(formData) } as any,
			locals: { auth: () => ({ userId: 'user123' }) } as any,
			url: { origin: 'http://localhost:3793' } as URL
		};

		// Act
		const result = await actions.uploadProfilePicture(mockEvent as any);

		// Assert
		expect(uploadProfilePicture).toHaveBeenCalledWith(mockFile, 'user123');
		expect(updatePlayer).toHaveBeenCalledWith('user123', {
			imageUrl: '/img/profiles/user123-1234567890.jpg'
		});
		expect(clerkClient.users.updateUserProfileImage).toHaveBeenCalledWith('user123', {
			file: expect.any(File)
		});
		expect(result).toEqual({
			success: true,
			path: '/img/profiles/user123-1234567890.jpg'
		});
		expect(logger.error).toHaveBeenCalledWith(
			'Failed to sync profile picture with Clerk',
			expect.any(Error),
			{ userId: 'user123' }
		);
	});

	it('should fail when no file is provided', async () => {
		// Arrange
		const mockFail = vi.mocked(fail);
		const formData = new FormData();
		const mockEvent: Partial<RequestEvent> = {
			request: { formData: () => Promise.resolve(formData) } as any,
			locals: { auth: () => ({ userId: 'user123' }) } as any,
			url: { origin: 'http://localhost:3793' } as URL
		};

		// Act
		await actions.uploadProfilePicture(mockEvent as any);

		// Assert
		expect(mockFail).toHaveBeenCalledWith(400, { error: 'No file provided' });
	});

	it('should fail when user is not authenticated', async () => {
		// Arrange
		const mockFail = vi.mocked(fail);
		const mockFile = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });
		const formData = new FormData();
		formData.append('file', mockFile);
		const mockEvent: Partial<RequestEvent> = {
			request: { formData: () => Promise.resolve(formData) } as any,
			locals: { auth: () => ({ userId: null }) } as any,
			url: { origin: 'http://localhost:3793' } as URL
		};

		// Act
		await actions.uploadProfilePicture(mockEvent as any);

		// Assert
		expect(mockFail).toHaveBeenCalledWith(401, { error: 'Not authenticated' });
	});
});
