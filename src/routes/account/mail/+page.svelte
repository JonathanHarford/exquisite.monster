<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { markAllAsReadSchema, markAsReadSchema } from '$lib/formSchemata';
	import type { PageData } from './$types';
	import { Button, Badge, Spinner } from 'flowbite-svelte';
	import DateComponent from '$lib/components/DateComponent.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { Notification } from '$lib/types/domain';
	import { appState } from '$lib/appstate.svelte';
	import SEO from '$lib/components/SEO.svelte';

	const { data }: { data: PageData } = $props();

	// Get page URL at component level for reactive access
	const pageUrl = $derived(page.url);

	// Local state for UI
	let showUnreadOnly = $derived(data.pagination.unreadOnly);
	let statusMessage = $state<string>('');
	// Initialize with current length, will be updated by effect
	// svelte-ignore state_referenced_locally
	let previousNotificationCount = $state(data.notifications.length);

	// Watch for new notifications from SSE and reload the page
	$effect(() => {
		const currentStoreCount = appState.notificationStore.notifications.length;
		// Only invalidate if we're on the first page and new notifications arrived
		// (checking count increase to avoid infinite loop)
		if (
			data.pagination.page === 1 &&
			currentStoreCount > previousNotificationCount &&
			previousNotificationCount > 0
		) {
			invalidateAll();
		}
		previousNotificationCount = currentStoreCount;
	});

	// Initialize Superform for mark all as read
	// svelte-ignore state_referenced_locally
	const markAllAsReadForm = superForm(data.markAllAsReadForm, {
		validators: zod4(markAllAsReadSchema),
		id: 'markAllAsRead',
		onUpdated: ({ form }) => {
			if (form.valid && form.message) {
				statusMessage = 'All notifications marked as read';
				invalidateAll();
				// Clear message after announcement
				setTimeout(() => (statusMessage = ''), 1000);
			}
		}
	});

	const { enhance: markAllAsReadEnhance, submitting: markAllAsReadSubmitting } = markAllAsReadForm;

	// Initialize Superform for mark individual notification as read
	// svelte-ignore state_referenced_locally
	const markAsReadForm = superForm(data.markAsReadForm, {
		validators: zod4(markAsReadSchema),
		id: 'markAsRead',
		onUpdated: ({ form }) => {
			if (form.valid && form.data?.notificationId) {
				// Update the store to reflect the read status change
				appState.notificationStore.markAsRead(form.data.notificationId);
				statusMessage = 'Notification marked as read';
				// Clear message after announcement
				setTimeout(() => (statusMessage = ''), 1000);
			}
		}
	});

	const { submitting: markAsReadSubmitting } = markAsReadForm;

	// Derived state
	const notifications = $derived(data.notifications);
	const unreadNotifications = $derived(notifications.filter((n: Notification) => !n.read));
	const displayedNotifications = $derived(showUnreadOnly ? unreadNotifications : notifications);

	// Function to calculate font size based on content length
	function getNotificationFontSize(notification: Notification): string {
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

	// Pagination helpers
	const hasPrevPage = $derived(data.pagination.page > 1);
	const hasNextPage = $derived(data.notifications.length === data.pagination.limit);

	async function goToPage(pageNum: number) {
		const url = new URL(pageUrl);
		url.searchParams.set('page', pageNum.toString());
		await goto(url.toString(), { invalidateAll: true });
	}

	// Function to handle clicking the View button
	async function handleViewClick(notification: Notification) {
		// Mark as read if unread
		if (!notification.read) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/markAsRead';

			const input = document.createElement('input');
			input.type = 'hidden';
			input.name = 'notificationId';
			input.value = notification.id;
			form.appendChild(input);

			document.body.appendChild(form);

			// Submit the form to mark as read
			const formData = new FormData(form);
			const response = await fetch('?/markAsRead', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				// Update the store to reflect the read status change
				appState.notificationStore.markAsRead(notification.id);
			}

			document.body.removeChild(form);
		}

		// Navigate to the action URL
		if (notification.actionUrl) {
			await goto(notification.actionUrl);
		}
	}

</script>

<SEO title="Notifications" description="View your game notifications and updates." noIndex={true} />

<!-- Skip link for keyboard navigation -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Live region for status announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{statusMessage}
</div>

<div id="main-content">
	<h2>Notifications</h2>

	<div class="header-row pb-2">
		<div role="status" aria-label="Notification count">
			<Badge color="blue" rounded>
				{notifications.length} total, {unreadNotifications.length} unread
			</Badge>
		</div>

		{#if unreadNotifications.length > 0}
			<form method="POST" action="?/markAllAsRead" use:markAllAsReadEnhance>
				<Button
					type="submit"
					color="green"
					size="sm"
					disabled={$markAllAsReadSubmitting}
					aria-describedby="mark-all-description"
				>
					{#if $markAllAsReadSubmitting}
						<Spinner class="mr-2" size="4" />
						<span class="sr-only">Marking all notifications as read...</span>
					{/if}
					Mark All as Read
				</Button>
			</form>
			<div id="mark-all-description" class="sr-only">
				Mark all {unreadNotifications.length} unread notifications as read
			</div>
		{/if}
	</div>

	{#if displayedNotifications.length === 0}
		<div class="card-bg">
			<div class="empty-state" role="status">
				<p>
					{showUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
				</p>
			</div>
		</div>
	{:else}
		<ul class="notifications-list ul" role="list" aria-label="Notifications">
			{#each displayedNotifications as notification (notification.id)}
				<li>
					<div class="card-bg">
						<div
							class="notification-content {notification.read
								? 'read-notification'
								: 'unread-notification'}"
							role="article"
							aria-label="{notification.read
								? 'Read'
								: 'Unread'} notification: {notification.title}"
							style={getNotificationFontSize(notification)}
						>
							<div class="notification-body">
								<div class="notification-badges">
									<Badge color="dark" rounded>
										{notification.type}
									</Badge>
									{#if !notification.read}
										<Badge color="red" rounded>New</Badge>
									{/if}
								</div>

								<h3 class="notification-title">{notification.title}</h3>

								<p class="notification-text">{notification.body}</p>
								{#if notification.actionUrl}
									<div>
										<Button
											color="blue"
											size="sm"
											onclick={() => handleViewClick(notification)}
											disabled={$markAsReadSubmitting}
										>
											View
										</Button>
									</div>
								{/if}

								<div class="notification-date">
									<DateComponent date={notification.createdAt} />
								</div>
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Pagination -->
	{#if hasPrevPage || hasNextPage}
		<div class="card-bg">
			<nav class="pagination" aria-label="Notifications pagination">
				<Button
					color="blue"
					disabled={!hasPrevPage}
					onclick={() => goToPage(data.pagination.page - 1)}
					aria-label="Go to previous page"
				>
					Previous
				</Button>

				<span aria-current="page" aria-label="Current page">
					Page {data.pagination.page}
				</span>

				<Button
					color="blue"
					disabled={!hasNextPage}
					onclick={() => goToPage(data.pagination.page + 1)}
					aria-label="Go to next page"
				>
					Next
				</Button>
			</nav>
		</div>
	{/if}
</div>

<style lang="postcss">
	.skip-link {
		@apply absolute left-0 top-0 z-50 -translate-y-full transform bg-primary-600 px-4 py-2 text-white transition-transform focus:translate-y-0;
	}

	.sr-only {
		@apply absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0;
		clip: rect(0, 0, 0, 0);
	}

	.header-row {
		@apply flex items-center justify-between;
	}

	.empty-state {
		@apply text-center;
	}

	.notifications-list {
		@apply list-none space-y-4 p-0;
	}

	.notification-content {
		@apply w-full;
	}

	.notification-content.read-notification {
		@apply opacity-50;
	}

	.notification-content.unread-notification {
		@apply opacity-100;
	}

	.notification-body {
		@apply min-w-0 flex-1 space-y-2;
	}

	.notification-badges {
		@apply flex items-center gap-2;
	}

	.notification-title {
		font-size: var(--notification-title-size, 1.125rem);
		@apply font-semibold leading-tight;
		word-wrap: break-word;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	.notification-text {
		font-size: var(--notification-body-size, 1rem);
		@apply leading-relaxed;
		word-wrap: break-word;
		overflow-wrap: break-word;
		hyphens: auto;
		white-space: pre-wrap;
	}

	.notification-date {
		@apply text-sm;
	}

	.pagination {
		@apply flex items-center justify-between;
	}
</style>
