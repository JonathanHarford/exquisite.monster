<script lang="ts">
	import { browser } from '$app/environment';
	import { appState } from '$lib/appstate.svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { onMount, onDestroy } from 'svelte';
	import { PUBLIC_DISABLE_POLLING } from '$env/static/public';
	import { getNotifications } from '../../routes/api/notifications.remote';

	const clerkContext = useClerkContext();
	let pollingInterval: ReturnType<typeof setInterval> | null = null;
	const POLLING_INTERVAL_MS = 30000; // 30 seconds

	// Fetch notifications from the API
	async function fetchNotifications() {
		if (!browser || !navigator.onLine) return;

		try {
			if (!clerkContext.clerk?.session) return;
			// Remote functions handle auth via cookies automatically
			const notifications = await getNotifications();

			// Use setNotifications to update the store with the latest list
			// Since we are polling, we might be overwriting local optimistic updates if we are not careful,
			// but for a notification list, replacing with the server state is usually correct.
			appState.notificationStore.setNotifications(notifications);
		} catch (error) {
			console.error('Error fetching notifications:', error);
		}
	}

	function startPolling() {
		if (!browser || PUBLIC_DISABLE_POLLING === 'true' || pollingInterval) return;

		// Initial fetch
		fetchNotifications();

		// Set up polling
		pollingInterval = setInterval(() => {
			fetchNotifications();
		}, POLLING_INTERVAL_MS);
	}

	function stopPolling() {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
	}

	// Watch for session changes to start/stop polling
	$: if (clerkContext.clerk?.session) {
		if (!pollingInterval) {
			startPolling();
		}
	} else {
		stopPolling();
		appState.notificationStore.setNotifications([]);
	}

	onMount(() => {
		console.log('NotificationListener mounted (Polling)');
		if (clerkContext.clerk?.session) {
			startPolling();
		}
	});

	onDestroy(() => {
		stopPolling();
	});
</script>
