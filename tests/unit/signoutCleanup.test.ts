import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearUserData } from '$lib/appstate.svelte';

// Extend globalThis type for our cached URLs
declare global {
	var cachedImageUrls: Record<string, string> | undefined;
}

// Mock browser environment
Object.defineProperty(global, 'localStorage', {
	value: {
		removeItem: vi.fn(),
		setItem: vi.fn(),
		getItem: vi.fn(),
		clear: vi.fn()
	},
	writable: true
});

Object.defineProperty(global, 'sessionStorage', {
	value: {
		removeItem: vi.fn(),
		setItem: vi.fn(),
		getItem: vi.fn(),
		clear: vi.fn()
	},
	writable: true
});

Object.defineProperty(global, 'URL', {
	value: {
		revokeObjectURL: vi.fn()
	},
	writable: true
});

// Mock window.caches for the Cache API
const mockCaches = {
	keys: vi.fn().mockResolvedValue(['user-cache', 'auth-cache', 'other-cache']),
	delete: vi.fn().mockResolvedValue(true)
};

Object.defineProperty(window, 'caches', {
	value: mockCaches,
	writable: true
});

// Mock browser environment flag
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('Sign-out cleanup', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Ensure mock implementation is reset (in case other tests changed it)
		mockCaches.keys.mockResolvedValue(['user-cache', 'auth-cache', 'other-cache']);

		// Reset global state
		globalThis.cachedImageUrls = {
			preview1: 'blob:http://localhost/123',
			preview2: 'blob:http://localhost/456'
		};

		// Suppress console.warn noise
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should clear all localStorage data', () => {
		clearUserData();

		expect(localStorage.clear).toHaveBeenCalled();
	});

	it('should clear all sessionStorage data', () => {
		clearUserData();

		expect(sessionStorage.clear).toHaveBeenCalled();
	});

	it('should revoke cached object URLs', () => {
		clearUserData();

		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/123');
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/456');
		expect(globalThis.cachedImageUrls).toEqual({});
	});

	it('should clear user-related browser caches', async () => {
		// Set up a more controlled promise resolution
		let resolveKeys!: (value: string[]) => void;
		const keysPromise = new Promise<string[]>((resolve) => {
			resolveKeys = resolve;
		});

		mockCaches.keys.mockReturnValue(keysPromise);

		clearUserData();

		// Verify that caches.keys was called
		expect(mockCaches.keys).toHaveBeenCalled();

		// Now resolve the promise with the cache names
		resolveKeys(['user-cache', 'auth-cache', 'other-cache']);

		// Wait for the promise chain to complete
		await keysPromise;

		// Give a small amount of time for the forEach to execute
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Check that delete was called for user/auth caches but not others
		const deleteCallArgs = mockCaches.delete.mock.calls.map((call) => call[0]);

		// Verify that user-related caches were deleted but not others
		expect(deleteCallArgs.length).toBeGreaterThan(0);
		expect(deleteCallArgs.some((name) => name.includes('user') || name.includes('auth'))).toBe(
			true
		);
		expect(deleteCallArgs).not.toContain('other-cache');
	});

	it('should handle storage errors gracefully', () => {
		// Mock localStorage.clear to throw errors
		vi.mocked(localStorage.clear).mockImplementation(() => {
			throw new Error('Storage error');
		});

		// Should not throw despite storage errors
		expect(() => clearUserData()).not.toThrow();
	});

	it('should handle URL revocation errors gracefully', () => {
		// Mock URL.revokeObjectURL to throw errors
		vi.mocked(URL.revokeObjectURL).mockImplementation(() => {
			throw new Error('URL revocation error');
		});

		// Should not throw despite URL errors
		expect(() => clearUserData()).not.toThrow();
	});

	it('should handle cache API errors gracefully', () => {
		// Mock caches.keys to reject
		mockCaches.keys.mockRejectedValue(new Error('Cache API error'));

		// Should not throw despite cache errors
		expect(() => clearUserData()).not.toThrow();
	});

	it('should work when browser APIs are not available', () => {
		// Temporarily remove browser APIs
		const originalLocalStorage = localStorage;
		const originalSessionStorage = sessionStorage;
		const originalCaches = window.caches;

		// TypeScript-safe deletion
		Object.defineProperty(window, 'localStorage', { value: undefined, writable: true });
		Object.defineProperty(window, 'sessionStorage', { value: undefined, writable: true });
		Object.defineProperty(window, 'caches', { value: undefined, writable: true });

		// Should not throw when APIs are not available
		expect(() => clearUserData()).not.toThrow();

		// Restore APIs
		Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true });
		Object.defineProperty(window, 'sessionStorage', {
			value: originalSessionStorage,
			writable: true
		});
		Object.defineProperty(window, 'caches', { value: originalCaches, writable: true });
	});
});
