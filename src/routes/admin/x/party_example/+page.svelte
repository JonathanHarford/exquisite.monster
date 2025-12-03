<script lang="ts">
	import PartyProgressGrid from '$lib/components/PartyProgressGrid.svelte';
	import { formatDuration, parseDuration } from '$lib/datetime';

	const { data } = $props();
	const gameConfig = $derived(data.games[0]?.config);
</script>

<svelte:head>
	<title>Party Example - Admin Dashboard</title>
</svelte:head>

{#if gameConfig}
	<div class="card">
		<h2>Party Configuration</h2>
		<div class="config-grid">
			<div><strong>Writing Timeout:</strong> {gameConfig.writingTimeout}</div>
			<div><strong>Drawing Timeout:</strong> {gameConfig.drawingTimeout}</div>
			<div><strong>Game Timeout:</strong> {gameConfig.gameTimeout}</div>
			<div>
				<strong>Turn Staleness:</strong> Stale at {formatDuration(
					(parseDuration(gameConfig.writingTimeout) * 2) / 3
				)}, Very Stale at {formatDuration(parseDuration(gameConfig.writingTimeout))}+
			</div>
		</div>
	</div>
{/if}

<PartyProgressGrid games={data.games} players={data.players} currentTime={data.simulationEndTime} />

<style>

	.config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
</style>
