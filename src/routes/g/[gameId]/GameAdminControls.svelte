<script lang="ts">
	import GameView from '$lib/components/GameView.svelte';
	import GameAnalytics from './GameAnalytics.svelte';
	import { enhance } from '$app/forms';
	import { Modal } from 'flowbite-svelte';
	import DateComponent from '$lib/components/DateComponent.svelte';
	import Debug from '$lib/components/Debug.svelte';
	import type { PageData } from './$types';

	const { data } = $props<{ data: PageData }>();
	const { game, gameAnalytics, flagTurnForm } = $derived.by(() => {
		// These will only be present for admins, so we need to be careful
		const gameData = data as any;
		return {
			game: gameData.game,
			gameAnalytics: gameData.gameAnalytics,
			flagTurnForm: gameData.flagTurnForm
		};
	});

	let showKillModal = $state(false);
	let isKilling = $state(false);
	let showFinishModal = $state(false);
	let isFinishing = $state(false);
	let isTogglingLewd = $state(false);
	let showResendModal = $state(false);
	let isResending = $state(false);
</script>

<div class="w-full rounded-lg border border-solid border-red-500 p-4">
	<h3>Admin Controls</h3>
	{#if gameAnalytics}
		<GameAnalytics {gameAnalytics} />
	{/if}

	<div>
		<!-- Admin Actions & Basic Info -->
		<div class="flex items-center justify-between">
			<h2>Game Overview</h2>
			<div class="flex gap-2">
				{#if !game.completedAt && !game.deletedAt}
					<button
						type="button"
						class="btn btn-primary"
						onclick={() => (showFinishModal = true)}
						disabled={isFinishing}
					>
						{isFinishing ? 'Finishing Game...' : 'Finish Game'}
					</button>
				{/if}

				{#if game.completedAt}
					<form method="POST" action="?/setPoster" use:enhance class="flex items-center gap-2">
						<select
							name="turnId"
							class="select select-sm"
							onchange={(e) => {
								const target = e.target as HTMLSelectElement;
								target.form?.requestSubmit();
							}}
						>
							<option value="" disabled selected={!game.posterTurnId}>Select Poster</option>
							{#each game.turns.filter((t: any) => t.isDrawing) as turn}
								<option value={turn.id} selected={turn.id === game.posterTurnId}>
									Turn {turn.orderIndex + 1}
								</option>
							{/each}
						</select>
					</form>
				{/if}

				<form
					method="POST"
					action="?/toggleLewd"
					use:enhance={() => {
						isTogglingLewd = true;
						return async ({ update }) => {
							await update();
							isTogglingLewd = false;
						};
					}}
				>
					<button type="submit" class="btn btn-cta" disabled={isTogglingLewd}>
						{#if isTogglingLewd}
							Updating...
						{:else if game.config.isLewd}
							&lt;18 OK
						{:else}
							18+
						{/if}
					</button>
				</form>

				{#if game.completedAt}
					<button
						type="button"
						class="btn btn-danger"
						onclick={() => (showResendModal = true)}
						disabled={isResending}
					>
						{isResending ? 'Sending...' : 'Resend Completion'}
					</button>
				{/if}

				<button
					type="button"
					class="btn btn-danger"
					onclick={() => (showKillModal = true)}
					disabled={isKilling}
				>
					{isKilling ? 'Killing Game...' : 'Kill Game'}
				</button>
			</div>
		</div>

		<div class="rounded-lg border border-solid border-black">
			<h3>Key Information</h3>
			<div class="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
				<div><strong>ID:</strong> <span class="font-mono">{game.id}</span></div>
				<div>
					<strong>Status:</strong>
					{#if game.deletedAt}
						<span>KILLED</span>
					{:else if game.completedAt}
						<span>Completed</span>
					{:else}
						<span>Active</span>
					{/if}
				</div>
				<div><strong>Created At:</strong> <DateComponent date={game.createdAt} /></div>
				<div>
					<strong>Completed At:</strong>
					{#if game.completedAt}
						<DateComponent date={game.completedAt} />
					{:else}
						N/A
					{/if}
				</div>
				{#if game.createdAt && game.completedAt}
					<div>
						<strong>Duration:</strong>
						{(() => {
							const durationMs =
								new Date(game.completedAt).getTime() - new Date(game.createdAt).getTime();
							const seconds = Math.floor((durationMs / 1000) % 60);
							const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
							const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
							let durationStr = '';
							if (hours > 0) durationStr += `${hours}h `;
							if (minutes > 0) durationStr += `${minutes}m `;
							if (seconds > 0 || durationStr === '') durationStr += `${seconds}s`;
							return durationStr.trim();
						})()}
					</div>
				{/if}
			</div>
		</div>
		<Debug value={game} />
	</div>
</div>

<!-- Kill Game Confirmation Modal -->
<Modal bind:open={showKillModal} autoclose={false}>
	<div class="text-center">
		<iconify-icon icon="material-symbols:warning" class="mx-auto h-14 w-14"></iconify-icon>
		<h3>Are you sure you want to kill this game?</h3>
		<p>This action cannot be undone. The game will be permanently deleted.</p>
		<div class="flex justify-center gap-4">
			<form
				method="POST"
				action="?/killGame"
				use:enhance={() => {
					isKilling = true;
					return async ({ update }) => {
						await update();
						isKilling = false;
						showKillModal = false;
					};
				}}
			>
				<button type="submit" class="btn btn-danger" disabled={isKilling}>
					{isKilling ? 'Killing...' : 'Yes, Kill Game'}
				</button>
			</form>
			<button
				type="button"
				class="btn btn-cancel"
				onclick={() => (showKillModal = false)}
				disabled={isKilling}
			>
				Cancel
			</button>
		</div>
	</div>
</Modal>

<!-- Resend Completion Confirmation Modal -->
<Modal bind:open={showResendModal} autoclose={false}>
	<div class="text-center">
		<iconify-icon icon="material-symbols:send" class="mx-auto h-14 w-14"></iconify-icon>
		<h3>Resend Completion Notification?</h3>
		<p>
			This will send the "Game Complete" notification (and email) to all participants again. Use
			this if the original notification failed to send.
		</p>
		<div class="flex justify-center gap-4">
			<form
				method="POST"
				action="?/resendCompletion"
				use:enhance={() => {
					isResending = true;
					return async ({ update }) => {
						await update();
						isResending = false;
						showResendModal = false;
					};
				}}
			>
				<button type="submit" class="btn btn-primary" disabled={isResending}>
					{isResending ? 'Sending...' : 'Yes, Resend'}
				</button>
			</form>
			<button
				type="button"
				class="btn btn-cancel"
				onclick={() => (showResendModal = false)}
				disabled={isResending}
			>
				Cancel
			</button>
		</div>
	</div>
</Modal>

<!-- Finish Game Confirmation Modal -->
<Modal bind:open={showFinishModal} autoclose={false}>
	<div class="text-center">
		<iconify-icon icon="material-symbols:check-circle" class="mx-auto h-14 w-14"></iconify-icon>
		<h3>Are you sure you want to finish this game?</h3>
		<p>
			This will mark the game as completed and notify all participants. This action cannot be
			undone.
		</p>
		<div class="flex justify-center gap-4">
			<form
				method="POST"
				action="?/finishGame"
				use:enhance={() => {
					isFinishing = true;
					return async ({ update }) => {
						await update();
						isFinishing = false;
						showFinishModal = false;
					};
				}}
			>
				<button type="submit" class="btn btn-primary" disabled={isFinishing}>
					{isFinishing ? 'Finishing...' : 'Yes, Finish Game'}
				</button>
			</form>
			<button
				type="button"
				class="btn btn-cancel"
				onclick={() => (showFinishModal = false)}
				disabled={isFinishing}
			>
				Cancel
			</button>
		</div>
	</div>
</Modal>
