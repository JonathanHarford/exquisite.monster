<script lang="ts">
	import AdminPartyTable from './AdminPartyTable.svelte';
	import { Heading, Badge } from 'flowbite-svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	let { partyList } = $derived(data);
</script>

<svelte:head>
	<title>Party Management - Admin Dashboard</title>
</svelte:head>

<div class="parties-page">
	<div>
		<div class="flex items-center justify-between">
			<div>
				<Heading tag="h3">Party Management</Heading>
				<p>Manage all parties on the platform</p>
			</div>
			<Badge color="blue">{partyList.length} Total Parties</Badge>
		</div>
	</div>

	<div class="rounded-lg border border-solid border-black">
		<AdminPartyTable {partyList} />
	</div>
</div>

<style lang="postcss">
	.parties-page {
		@apply mx-auto max-w-7xl;
	}
</style>
