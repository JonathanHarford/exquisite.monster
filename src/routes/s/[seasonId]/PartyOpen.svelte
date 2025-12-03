<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ErrorBox from '$lib/components/ErrorBox.svelte';
	import { Modal, Button } from 'flowbite-svelte';
	import type { Season, SeasonPlayer, Player } from '$lib/types/domain';

	interface Props {
		party: Season;
		seasonPlayers: SeasonPlayer[];
		players: Player[];
		favoritePlayersResult: Array<{ id: string; username: string; imageUrl: string }>;
		isParticipant: boolean;
		hasAccepted: boolean;
		isCreator: boolean;
		isAdmin: boolean;
		creatorUsername: string;
	}

	const {
		party,
		seasonPlayers,
		players,
		favoritePlayersResult = [],
		isParticipant,
		hasAccepted,
		isCreator,
		isAdmin,
		creatorUsername
	}: Props = $props();

	// Map players for easy access
	const playerMap = $derived(new Map(players.map((p) => [p.id, p])));

	// Separate players into different categories
	const joinedPlayers = $derived(
		seasonPlayers
			.filter((p) => p.joinedAt !== null)
			.map((sp) => {
				const player = playerMap.get(sp.playerId);
				return {
					...sp,
					username: player?.username || 'Unknown',
					imageUrl: player?.imageUrl || '/default-avatar.png'
				};
			})
	);
	const invitedPlayers = $derived(
		seasonPlayers
			.filter((p) => p.joinedAt === null)
			.map((sp) => {
				const player = playerMap.get(sp.playerId);
				return {
					...sp,
					username: player?.username || 'Unknown',
					imageUrl: player?.imageUrl || '/default-avatar.png'
				};
			})
	);

	// Get current player IDs to filter out already invited/joined players
	const currentPlayerIds = $derived(seasonPlayers.map((p) => p.playerId));

	// Filter favorite players to only show those not already in party
	const invitablePlayers = $derived(
		favoritePlayersResult.filter((player) => !currentPlayerIds.includes(player.id))
	);

	// Modal states
	let showCancelModal = $state(false);
	let showStartModal = $state(false);

	// Selected players for invitation
	let selectedPlayerIds = $state<string[]>([]);

	// Toggle player selection
	function togglePlayerSelection(playerId: string) {
		if (selectedPlayerIds.includes(playerId)) {
			selectedPlayerIds = selectedPlayerIds.filter((id) => id !== playerId);
		} else {
			selectedPlayerIds = [...selectedPlayerIds, playerId];
		}
	}

	// Clear selection after successful invitation
	function clearSelection() {
		selectedPlayerIds = [];
	}

	// Format turn assignment display
	function formatTurnAssignment(algorithm: string): string {
		return algorithm === 'round-robin' ? 'Round Robin' : 'Algorithmic';
	}
</script>

<div>
	<!-- Join Party Button for Invited Players -->
	{#if isParticipant && !hasAccepted}
		<div class="py-4">
			<form
				method="POST"
				action="?/acceptInvitation"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
					};
				}}
			>
				<Button type="submit" size="lg" color="blue" class="w-full">Join Party</Button>
			</form>
		</div>
	{/if}

	<h3>Players</h3>
	<div class="flex flex-col gap-2">
		{#if joinedPlayers.length > 0}
			<div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
				{#each joinedPlayers as player}
					<div class="card flex flex-row items-center gap-2">
						<img
							src={player.imageUrl || '/default-avatar.png'}
							alt={player.username}
							class="h-10 w-10 rounded-full"
						/>
						<span>{player.username}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p>No players have joined yet.</p>
		{/if}

		{#if invitedPlayers.length > 0}
			<h4>Invited ({invitedPlayers.length})</h4>
			<div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
				{#each invitedPlayers as player}
					{#if isAdmin}
						<form
							method="POST"
							action="?/adminJoinPlayer"
							use:enhance={() => {
								return async ({ result, update }) => {
									await update();
								};
							}}
						>
							<input type="hidden" name="playerId" value={player.playerId} />
							<button
								type="submit"
								class="card flex w-full cursor-pointer flex-row items-center gap-2 text-left transition-colors hover:bg-gray-50"
								title="Click to join {player.username} to the party"
							>
								<img
									src={player.imageUrl || '/default-avatar.png'}
									alt={player.username}
									class="h-10 w-10 rounded-full"
								/>
								<div>{player.username}</div>
							</button>
						</form>
					{:else}
						<div class="card flex flex-row items-center gap-2">
							<img
								src={player.imageUrl || '/default-avatar.png'}
								alt={player.username}
								class="h-10 w-10 rounded-full"
							/>
							<div>{player.username}</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<p>No pending invitations.</p>
		{/if}

		{#if party.allowPlayerInvites}
			<p>All players may invite.</p>
		{:else}
			<p>Only creator may invite.</p>
		{/if}
		
		<!-- Invitable Players -->
		{#if (isCreator || isAdmin || (party.allowPlayerInvites && hasAccepted)) && invitablePlayers.length > 0}
			<h4>Invitable ({invitablePlayers.length})</h4>
			<div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
				{#each invitablePlayers as player}
					<div class="card flex flex-row items-center gap-2">
						<input type="checkbox" bind:group={selectedPlayerIds} value={player.id} />
						<img
							src={player.imageUrl || '/default-avatar.png'}
							alt={player.username}
							class="h-10 w-10 rounded-full"
						/>
						<span>{player.username}</span>
					</div>
				{/each}
			</div>

			<form
				method="POST"
				action="?/invitePlayers"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							clearSelection();
						}
						await update();
					};
				}}
			>
				{#each selectedPlayerIds as playerId}
					<input type="hidden" name="playerIds" value={playerId} />
				{/each}

				<Button type="submit" color="blue" disabled={selectedPlayerIds.length === 0}>
					{#if selectedPlayerIds.length === 0}
						Invite Players
					{:else}
						Invite {selectedPlayerIds.length} Player{selectedPlayerIds.length === 1 ? '' : 's'}
					{/if}
				</Button>
			</form>
		{/if}
	</div>

	<!-- Action Buttons -->
	{#if isCreator || isAdmin}
		<div class="flex gap-2 py-4">
			<Button color="red" onclick={() => (showCancelModal = true)}>Cancel Party</Button>
			<Button
				color="green"
				disabled={joinedPlayers.length < 2}
				onclick={() => (showStartModal = true)}
			>
				Start Party
			</Button>
		</div>
	{/if}

	<!-- Error Messages -->
	{#if page.form?.error}
		<ErrorBox>
			<p>{page.form.error}</p>
		</ErrorBox>
	{/if}
</div>

<!-- Cancel Party Confirmation Modal -->
<Modal bind:open={showCancelModal} size="md" title="Cancel Party">
	<div class="space-y-4">
		<p>Are you sure you want to cancel this party?</p>
		<p class="text-sm">
			This action will permanently delete the party and notify all invited players. This cannot be
			undone.
		</p>
	</div>

	<svelte:fragment slot="footer">
		<Button color="alternative" onclick={() => (showCancelModal = false)}>Keep Party</Button>
		<form method="POST" action="?/cancelParty" use:enhance>
			<Button type="submit" color="red">Yes, Cancel Party</Button>
		</form>
	</svelte:fragment>
</Modal>

<!-- Start Party Confirmation Modal -->
<Modal bind:open={showStartModal} size="md" title="Start Party">
	<div class="space-y-4">
		<p>Ready to start the party with {joinedPlayers.length} players?</p>
		{#if joinedPlayers.length < 7}
			<div class="rounded-md bg-yellow-50 p-3">
				<p class="text-sm text-yellow-800">
					⚠️ We recommend at least 7 players for the best experience.
				</p>
			</div>
		{/if}
	</div>

	<svelte:fragment slot="footer">
		<Button color="alternative" onclick={() => (showStartModal = false)}>Not Yet</Button>
		<form
			method="POST"
			action="?/forceStartParty"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						// Force page refresh to show updated party status
						window.location.reload();
					} else {
						await update();
					}
				};
			}}
		>
			<Button type="submit" color="green">Start Party</Button>
		</form>
	</svelte:fragment>
</Modal>
