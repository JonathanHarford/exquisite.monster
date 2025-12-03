<script lang="ts">
	import type { PageData } from './$types';
	import {
		Heading,
		Table,
		TableBody,
		TableHead,
		TableHeadCell,
		TableBodyCell,
		TableBodyRow,
		Badge
	} from 'flowbite-svelte';

	let { data }: { data: PageData } = $props();

	let { events } = $derived(data);

	function formatEventType(type: string) {
		return type.replace(/([A-Z])/g, ' $1').trim(); // Add space before caps
	}
</script>

<svelte:head>
	<title>Admin Dashboard</title>
</svelte:head>

<div class="admin-dashboard">
	<Heading tag="h2">Admin Dashboard</Heading>
	<div class="card-bg">
		<Heading tag="h3">Recent Activity</Heading>
		<div class="overflow-x-auto">
			<Table hoverable={true} class="text-sm">
				<TableHead>
					<TableHeadCell>Timestamp</TableHeadCell>
					<TableHeadCell>Type</TableHeadCell>
					<TableHeadCell>Description</TableHeadCell>
				</TableHead>
				<TableBody>
					{#each events as event}
						<TableBodyRow>
							<TableBodyCell>{new Date(event.timestamp).toLocaleString()}</TableBodyCell>
							<TableBodyCell>
								<Badge color="indigo" class="whitespace-nowrap" href={event.link}
									>{formatEventType(event.type)}</Badge
								>
							</TableBodyCell>
							<TableBodyCell>
								{event.description}
							</TableBodyCell>
						</TableBodyRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	</div>
</div>

<style lang="postcss">
	.admin-dashboard {
		/* Add any specific overall styles for the dashboard page here */
	}
	/* Ensure table cells don't force too much wrapping for descriptions */
	:global(td.break-normal) {
		word-break: normal; /* or break-word if needed */
	}
</style>
