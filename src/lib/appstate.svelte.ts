import type { Game, Notification, Turn } from './types/domain';
import { PUBLIC_SITE_TITLE } from '$env/static/public';
import type { Timer } from './Timer.svelte';
import { browser } from '$app/environment';

export const appState = $state<{
	ui: {
		siteTitle: string;
		loading: boolean;
		timerSoon: boolean;
		debug: boolean;
	};
	play: {
		game?: Game;
		pendingTurn?: Turn;
		pendingPartyTurnCount?: number;
	};
	timer?: Timer;
	audio: string | undefined;
	notificationStore: {
		notifications: Notification[];
		unreadCount: number;
		loading: boolean;
		error: string | null;
		connected: boolean;
	};
}>({
	ui: {
		siteTitle: PUBLIC_SITE_TITLE,
		loading: false,
		timerSoon: false,
		debug: false
	},
	play: {
		game: undefined,
		pendingTurn: undefined,
		pendingPartyTurnCount: undefined
	},
	notificationStore: {
		notifications: [],
		unreadCount: 0,
		loading: false,
		error: null,
		connected: false
	},
	timer: undefined,
	audio: undefined // path to audio file
});

// Helper function to clear user-specific data (useful for logout)
export function clearUserData() {
	// Clear app state
	appState.play.game = undefined;
	appState.play.pendingTurn = undefined;
	appState.play.pendingPartyTurnCount = undefined;
	appState.notificationStore.notifications = [];
	appState.notificationStore.unreadCount = 0;
	appState.notificationStore.error = null;
	appState.notificationStore.connected = false;
	appState.notificationStore.loading = false;

	// Clean up any active timers
	if (appState.timer) {
		appState.timer.cleanup();
		appState.timer = undefined;
	}

	// Reset UI state that might be user-specific
	appState.ui.timerSoon = false;
	appState.audio = undefined;

	// Browser-specific cleanup (only in browser environment)
	if (browser) {
		try {
			// Clear all browser storage since this app is the only thing on the domain
			// This ensures complete removal of all user traces during sign-out

			// Clear all localStorage
			try {
				localStorage.clear();
			} catch {
				// Ignore localStorage errors
			}

			// Clear all sessionStorage
			try {
				sessionStorage.clear();
			} catch {
				// Ignore sessionStorage errors
			}

			// Clear any cached object URLs that might have been created for image previews
			// Note: We can't track all object URLs, but we clear any that might be stored in global scope
			const globalWithCache = globalThis as typeof globalThis & {
				cachedImageUrls?: Record<string, string>;
			};
			if (globalWithCache.cachedImageUrls) {
				Object.values(globalWithCache.cachedImageUrls).forEach((url) => {
					try {
						URL.revokeObjectURL(url);
					} catch {
						// Ignore revocation errors
					}
				});
				globalWithCache.cachedImageUrls = {};
			}

			// Clear any IndexedDB data (if we were using it)
			// For now, we don't use IndexedDB, but this is here for future-proofing
			if ('indexedDB' in window) {
				try {
					// We don't currently use IndexedDB, but if we did, we'd clear it here
					// indexedDB.deleteDatabase('epyc-user-data');
				} catch {
					// Ignore IndexedDB errors
				}
			}

			// Clear any cached responses in the browser's HTTP cache related to user data
			// This uses the Cache API if available (Service Worker context)
			if ('caches' in window) {
				caches
					.keys()
					.then((cacheNames) => {
						cacheNames.forEach((cacheName) => {
							if (cacheName.includes('user') || cacheName.includes('auth')) {
								caches.delete(cacheName).catch(() => {
									// Ignore cache deletion errors
								});
							}
						});
					})
					.catch(() => {
						// Ignore cache API errors
					});
			}
		} catch (error) {
			// Log the error but don't throw - sign out should continue even if cleanup fails
			console.warn('Some user data cleanup failed during sign out:', error);
		}
	}
}

if (browser) {
	(globalThis as { appState?: typeof appState; getAppState?: () => typeof appState }).appState =
		appState;

	// Helper function to get a readable snapshot of the state
	(globalThis as { getAppState?: () => typeof appState }).getAppState = () => {
		return JSON.parse(JSON.stringify(appState));
	};
}
