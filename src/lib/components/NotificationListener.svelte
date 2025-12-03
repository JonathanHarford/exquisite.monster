<script lang="ts">
	import { browser } from '$app/environment';
	import { notificationActions } from '$lib/stores/notifications.svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { onMount } from 'svelte';
	import { PUBLIC_DISABLE_POLLING } from '$env/static/public';

	let eventSource: EventSource | null = null;
	const clerkContext = useClerkContext();

	// Initial fetch to populate notifications
	async function fetchInitialNotifications() {
		if (!browser || !navigator.onLine) return;

		try {
			if (!clerkContext.clerk?.session) return;
			const token = await clerkContext.clerk.session.getToken();

			if (!token) return;

			const response = await fetch('/api/notifications', {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (response.ok) {
				const notifications = await response.json();
				notificationActions.setNotifications(notifications);
			}
		} catch (error) {
			console.error('Error fetching initial notifications:', error);
		}
	}

	async function startSSE() {
		if (!browser || PUBLIC_DISABLE_POLLING === 'true' || eventSource) return;

		// Wait for session to be ready
		await new Promise((resolve) => {
			const interval = setInterval(() => {
				if (clerkContext.clerk?.session) {
					clearInterval(interval);
					resolve(true);
				}
			}, 1000);
		});

		// Fetch existing notifications first
		await fetchInitialNotifications();

		eventSource = new EventSource('/api/notifications/sse');

		eventSource.onopen = () => {
			console.log('SSE connection opened');
		};

		eventSource.addEventListener('notification', (event) => {
			try {
				const notification = JSON.parse(event.data);
				notificationActions.addNotification(notification);
			} catch (err) {
				console.error('Error parsing notification event:', err);
			}
		});

		eventSource.onerror = (err) => {
			console.error('SSE error:', err);
			// EventSource automatically attempts to reconnect
			// We could close it if unauthorized, but standard EventSource API
			// doesn't give status codes easily.
		};
	}

	function stopSSE() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}

		// Clear notification data when stopping (user signed out)
		notificationActions.setNotifications([]);
	}

	onMount(() => {
		console.log('NotificationListener mounted (SSE)');
		startSSE();
		return () => {
			stopSSE();
		};
	});
</script>
