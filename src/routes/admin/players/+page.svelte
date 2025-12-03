<script lang="ts">
	import AdminPlayerTable from './AdminPlayerTable.svelte';
	import { Heading, Badge } from 'flowbite-svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	let { playerList } = $derived(data);
</script>

<svelte:head>
	<title>Player Management - Admin Dashboard</title>
</svelte:head>

<div class="players-page">
	<div>
		<div class="flex items-center justify-between">
			<div>
				<Heading tag="h3">Player Management</Heading>
				<p>Manage user accounts, permissions, and player activity</p>
			</div>
			<Badge color="blue">{playerList.length} Total Players</Badge>
		</div>
	</div>

	<div class="rounded-lg border border-solid border-black">
		<AdminPlayerTable {playerList} />
	</div>
</div>

<style lang="postcss">
	.players-page {
		@apply mx-auto max-w-7xl;
	}
</style>
