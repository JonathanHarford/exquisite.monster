<script lang="ts">
	import type { PageData } from './$types';
	import PartyOpen from './PartyOpen.svelte';
	import PartyProgressGrid from '$lib/components/PartyProgressGrid.svelte';
	import GameGallery from '$lib/components/GameGallery.svelte';
	import { Modal } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import Debug from '$lib/components/Debug.svelte';

	let { data }: { data: PageData } = $props();

	const { party, seasonPlayers, players, games, completedGames, favoritePlayersResult, isParticipant, hasAccepted, isCreator, isAdmin, creatorUsername } = $derived(data);

	// Get current time for PartyProgressGrid
	const currentTime = $derived(new Date());

	// Show confirmation modal state
	let showDeleteConfirmation = $state(false);
</script>

<svelte:head>
	<title>{party.title} - EPYC</title>
</svelte:head>

<div>
	<div class="mb-4 flex items-start justify-between">
		<div>
			<h2>{party.title}</h2>
			<div>Creator: {creatorUsername}</div>
		</div>

		{#if isAdmin}
			<button type="button" class="btn btn-danger" onclick={() => (showDeleteConfirmation = true)}>
				{party.status === 'open' ? 'Cancel Party' : 'Delete Party'}
			</button>
		{/if}
	</div>

	{#if party.status === 'open'}
		<PartyOpen
			{party}
			{seasonPlayers}
			{players}
			{favoritePlayersResult}
			{isParticipant}
			{hasAccepted}
			{isCreator}
			{isAdmin}
			{creatorUsername}
		/>
	{:else}
		<div class="mb-4">
			{#if party.status === 'active'}
				<p>
					Party in Progress - {seasonPlayers.filter((p) => p.joinedAt !== null).length} players.
				</p>
			{:else if party.status === 'closed'}
				<div class="alert alert-warning">
					<iconify-icon icon="mdi:cancel" class="text-xl"></iconify-icon>
					<span>This party has been cancelled. All games and turns have been cancelled.</span>
				</div>
			{:else if party.status === 'completed'}
				<p>
					Party Completed - {seasonPlayers.filter((p) => p.joinedAt !== null).length} players.
				</p>
			{/if}
		</div>
		{#if party.status !== 'closed'}
			<div>
				{#if games.length > 0}
					{#if party.status === 'completed' && completedGames.length > 0}
						<p class="mb-6">
							All games are complete! Now, you are <i>well within your rights</i> to each sit at your
							own device and <acronym title="Laugh Quietly To Myself">LQTM</acronym> at the results. 
							But I promise you, you will have such a good time if
							you hop on a video call and each present your turns. It really is the icing on the cake.
						</p>
						<div class="mb-6">
							<GameGallery games={completedGames} />
						</div>
					{/if}
					<PartyProgressGrid
						{games}
						{players}
						{isParticipant}
						{currentTime}
						currentUserId={data.self?.id}
					/>
				{:else if party.status === 'completed'}
					<p>No completed games to display.</p>
				{:else}
					<p>No games have started yet.</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Delete/Cancel Confirmation Modal -->
<Modal bind:open={showDeleteConfirmation} size="md" outsideclose>
	<div class="text-center">
		<iconify-icon icon="mdi:alert-circle" class="mb-4 text-6xl text-danger-500"></iconify-icon>
		<h3>
			{party.status === 'open' ? 'Cancel Party' : 'Delete Party'}
		</h3>
		<p>
			{#if party.status === 'open'}
				Are you sure you want to cancel "{party.title}"? This will remove all invitations and cannot
				be undone.
			{:else}
				Are you sure you want to delete "{party.title}"? This will permanently remove all data and
				cannot be undone.
			{/if}
		</p>
		<div class="flex justify-center gap-4">
			<button type="button" class="btn btn-cancel" onclick={() => (showDeleteConfirmation = false)}>
				Cancel
			</button>
			<form
				method="POST"
				action="?/cancelParty"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success' || result.type === 'redirect') {
							showDeleteConfirmation = false;
						}
					};
				}}
			>
				<button type="submit" class="btn btn-danger">
					{party.status === 'open' ? 'Yes, Cancel Party' : 'Yes, Delete Party'}
				</button>
			</form>
		</div>
	</div>
</Modal>

<Debug value={games} />