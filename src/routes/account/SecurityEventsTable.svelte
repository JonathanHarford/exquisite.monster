<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import {
		Button,
		Spinner,
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyCell,
		TableBodyRow,
		Alert
	} from 'flowbite-svelte';
	import DateComponent from '$lib/components/DateComponent.svelte';
	import { enhance } from '$app/forms'; // Explicit import for enhance
	import type { ActionResult } from '@sveltejs/kit';

	// This type would ideally be passed in or defined more generically if the component
	// is to be used with different action data structures.
	// For now, we'll assume a structure consistent with the previous implementation.
	type SecurityEvent = {
		id: string;
		status: string;
		ipAddress: string;
		userAgent: string;
		city: string;
		country: string;
		createdAt: string; // Assuming ISO string
		// Add any other fields that were present and used
	};

	// Props if we want to customize the action URL later
	// export let actionUrl: string = '?/loadSecurityEvents';

	let securityEvents: Writable<SecurityEvent[] | null> = writable(null);
	let securityEventsLoading = writable(false);
	let securityEventsError: Writable<string | null> = writable(null);
	let securityEventsLoaded = writable(false);

	function handleLoadSecurityEventsSubmit() {
		securityEventsLoading.set(true);
		securityEventsError.set(null);
		// securityEvents.set(null); // Optionally clear previous events

		return async ({ result }: { result: ActionResult }) => {
			securityEventsLoading.set(false);
			securityEventsLoaded.set(true);

			// Type guard for result.data
			const data = (result.type === 'success' || result.type === 'failure') 
				? (result as any).data as { securityEvents?: SecurityEvent[]; error?: string } | null 
				: null;

			if (result.type === 'success' && data?.securityEvents) {
				securityEvents.set(data.securityEvents);
			} else if (result.type === 'failure' || data?.error) {
				securityEventsError.set(data?.error || 'Failed to load security events.');
				securityEvents.set(null);
			} else {
				// Handle uncaught errors from action
				securityEventsError.set('An unexpected error occurred.');
				securityEvents.set(null);
			}
			// No need for `update()` here as this component manages its own state from action result
		};
	}
</script>

<div class="security-events-container">
	<h3>Login Events</h3>

	<form method="POST" action="?/loadSecurityEvents" use:enhance={handleLoadSecurityEventsSubmit}>
		<Button type="submit" disabled={$securityEventsLoading} class="btn btn-primary">
			{#if $securityEventsLoading}
				<Spinner class="mr-2" size="4" /> Loading...
			{:else if $securityEventsLoaded}
				Refresh Activity
			{:else}
				Load Recent Activity
			{/if}
		</Button>
	</form>

	{#if $securityEventsLoading && !$securityEventsLoaded}
		<div class="text-center">
			<Spinner size="6" />
			<p>Loading activity...</p>
		</div>
	{/if}

	{#if $securityEventsError}
		<Alert color="red">
			{$securityEventsError}
		</Alert>
	{/if}

	{#if $securityEvents && $securityEvents.length > 0}
		<div class="mt-4 overflow-x-auto">
			<Table hoverable={true}>
				<TableHead>
					<TableHeadCell>Date</TableHeadCell>
					<TableHeadCell>Status</TableHeadCell>
					<TableHeadCell>IP Address</TableHeadCell>
					<TableHeadCell>Device/Browser</TableHeadCell>
					<TableHeadCell>Location</TableHeadCell>
				</TableHead>
				<TableBody>
					{#each $securityEvents as event (event.id)}
						<TableBodyRow>
							<TableBodyCell>
								<DateComponent date={event.createdAt} />
							</TableBodyCell>
							<TableBodyCell class="capitalize">{event.status}</TableBodyCell>
							<TableBodyCell>{event.ipAddress}</TableBodyCell>
							<TableBodyCell class="whitespace-nowrap">{event.userAgent}</TableBodyCell>
							<TableBodyCell>{event.city}, {event.country}</TableBodyCell>
						</TableBodyRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{:else if $securityEventsLoaded && !$securityEventsError && !$securityEventsLoading}
		<p class="mt-4 text-primary-500">No recent activity found.</p>
	{/if}
</div>
