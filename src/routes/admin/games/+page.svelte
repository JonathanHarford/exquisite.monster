<script lang="ts">
	import AdminGameTable from '$lib/components/AdminGameTable.svelte';
	import Importer from './Importer.svelte';
	import { Badge } from 'flowbite-svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	let { gameList } = $derived(data);
</script>

<svelte:head>
	<title>Game Management - Admin Dashboard</title>
</svelte:head>

<div class="games-page">
	<div>
		<div class="flex items-center justify-between">
			<div>
				<h2>Game Management</h2>
				<p>Manage games, analytics, and game-related settings</p>
			</div>
			<Badge color="green">{gameList.length} Total Games</Badge>
		</div>
	</div>
	<AdminGameTable {gameList} />
	<Importer />
</div>
