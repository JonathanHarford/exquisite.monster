<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';

	let {
		isOpen = $bindable(false),
		partyTitle = '',
		partyId = '',
		favoritePlayerOptions = [],
		currentPlayerIds = [],
		onClose,
		onSuccess
	}: {
		isOpen?: boolean;
		partyTitle?: string;
		partyId?: string;
		favoritePlayerOptions?: Array<{ id: string; name: string; imageUrl: string }>;
		currentPlayerIds?: string[];
		onClose?: () => void;
		onSuccess?: () => void;
	} = $props();

	let selectedPlayerIds = $state<string[]>([]);
	let playerSearchTerm = $state('');
	let isSubmitting = $state(false);

	const availablePlayers = $derived(
		favoritePlayerOptions
			.filter((player) => !currentPlayerIds.includes(player.id))
			.filter((player) => player.name.toLowerCase().includes(playerSearchTerm.toLowerCase()))
	);

	function togglePlayerSelection(playerId: string) {
		if (selectedPlayerIds.includes(playerId)) {
			selectedPlayerIds = selectedPlayerIds.filter((id) => id !== playerId);
		} else {
			selectedPlayerIds = [...selectedPlayerIds, playerId];
		}
	}

	function toggleAllVisible() {
		const visibleIds = availablePlayers.map((p) => p.id);
		const allSelected = visibleIds.every((id) => selectedPlayerIds.includes(id));

		if (allSelected) {
			selectedPlayerIds = selectedPlayerIds.filter((id) => !visibleIds.includes(id));
		} else {
			selectedPlayerIds = [...new Set([...selectedPlayerIds, ...visibleIds])];
		}
	}

	function closeModal() {
		isOpen = false;
		selectedPlayerIds = [];
		playerSearchTerm = '';
		onClose?.();
	}

	function handleSubmitResult({ result }: { result: ActionResult }) {
		if (result.type === 'success') {
			onSuccess?.();
			closeModal();
		}
		isSubmitting = false;
	}
</script>

{#if isOpen}
	<!-- Modal backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
		onclick={closeModal}
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
	>
		<!-- Modal content -->
		<div
			class="max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="none"
		>
			<!-- Header -->
			<div class="border-b border-gray-200 p-6">
				<h3 id="modal-title" class="text-lg font-semibold text-gray-900">Invite More Players</h3>
				<p class="mt-1 text-sm text-gray-600">
					Invite additional players to "{partyTitle}"
				</p>
			</div>

			<!-- Content -->
			<div class="max-h-96 overflow-y-auto p-6">
				{#if availablePlayers.length === 0 && playerSearchTerm === ''}
					<div class="py-8 text-center text-gray-500">
						<p>All your favorite players are already invited to this party.</p>
						<p class="mt-2 text-sm">Visit player profiles to add more favorites.</p>
					</div>
				{:else}
					<!-- Search and controls -->
					<div class="mb-4 space-y-3">
						<div class="flex space-x-3">
							<input
								type="text"
								bind:value={playerSearchTerm}
								placeholder="Search players..."
								class="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							{#if availablePlayers.length > 0}
								<button
									type="button"
									onclick={toggleAllVisible}
									class="rounded-md bg-blue-100 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-200"
								>
									{#if availablePlayers.every((p) => selectedPlayerIds.includes(p.id))}
										Deselect All
									{:else}
										Select All
									{/if}
								</button>
							{/if}
						</div>

						{#if playerSearchTerm && availablePlayers.length === 0}
							<div class="text-sm text-gray-500">
								No players found matching "{playerSearchTerm}"
							</div>
						{/if}
					</div>

					<!-- Player list -->
					{#if availablePlayers.length > 0}
						<div class="space-y-2">
							{#each availablePlayers as player}
								<label
									class="flex cursor-pointer items-center rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
								>
									<input
										type="checkbox"
										checked={selectedPlayerIds.includes(player.id)}
										onchange={() => togglePlayerSelection(player.id)}
										class="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<img
										src={player.imageUrl}
										alt={player.name}
										class="mr-3 h-10 w-10 rounded-full"
									/>
									<span class="font-medium">{player.name}</span>
								</label>
							{/each}
						</div>

						{#if selectedPlayerIds.length > 0}
							<div class="mt-4 rounded-md bg-blue-50 p-3">
								<div class="text-sm text-blue-800">
									<strong>{selectedPlayerIds.length}</strong> player{selectedPlayerIds.length === 1
										? ''
										: 's'} selected
								</div>
							</div>
						{/if}
					{/if}
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex justify-end space-x-3 border-t border-gray-200 p-6">
				<button
					type="button"
					onclick={closeModal}
					class="rounded-md bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300"
					disabled={isSubmitting}
				>
					Cancel
				</button>

				{#if selectedPlayerIds.length > 0}
					<form
						method="POST"
						action="?/invitePlayers"
						use:enhance={({ formData }) => {
							isSubmitting = true;
							selectedPlayerIds.forEach((id) => formData.append('playerIds', id));
							return handleSubmitResult;
						}}
					>
						<button
							type="submit"
							disabled={isSubmitting}
							class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isSubmitting}
								Sending Invites...
							{:else}
								Invite {selectedPlayerIds.length} Player{selectedPlayerIds.length === 1 ? '' : 's'}
							{/if}
						</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure modal appears above other content */
	:global(body.modal-open) {
		overflow: hidden;
	}
</style>
