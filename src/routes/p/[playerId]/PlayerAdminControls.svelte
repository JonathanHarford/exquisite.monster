<script lang="ts">
	import { enhance } from '$app/forms';
	import DateComponent from '$lib/components/DateComponent.svelte';
	import AdminGameTable from '$lib/components/AdminGameTable.svelte';
	import {
		Heading,
		Avatar,
		Badge,
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyCell,
		Alert,
		Tooltip,
		Button,
		Modal
	} from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import type { PageData, ActionData } from './$types';

	const { data, form } = $props<{ data: PageData; form: any }>();
	const { playerDetails, playerGames, emailPromise } = $derived.by(() => {
		const pageData = data as any;
		return {
			playerDetails: pageData.playerDetails,
			playerGames: pageData.playerGames,
			emailPromise: pageData.emailPromise
		};
	});

	let showDeleteModal = $state(false);
	let isDeleting = $state(false);

	// Handle successful deletion by redirecting to players list
	$effect(() => {
		if (form && typeof form === 'object' && 'deleted' in form && form.deleted) {
			goto('/admin/players');
		}
	});

	// Helper function to format time ago
	const timeAgo = (date: Date) => {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	};
</script>

<div class="w-full rounded-lg border border-solid border-red-500 p-4">
	<h3>Admin Controls</h3>

	{#if form?.error}
		<Alert color="red" class="mb-4">
			<iconify-icon icon="material-symbols:error" class="mr-2 h-4 w-4"></iconify-icon>
			{form.error}
		</Alert>
	{/if}

	{#if form?.success && form?.deleted}
		<Alert color="green" class="mb-4">
			<iconify-icon icon="material-symbols:check-circle" class="mr-2 h-4 w-4"></iconify-icon>
			Player {form.username} has been successfully deleted.
		</Alert>
	{/if}

	{#if !playerDetails}
		<Alert color="red">
			<iconify-icon icon="material-symbols:error" class="mr-2 h-4 w-4"></iconify-icon>
			Player not found
		</Alert>
	{:else}
		<div class="content-container">
			<!-- Header with basic info and actions -->
			<section>
				<div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4">
							<Avatar src={playerDetails.imageUrl} data-name={playerDetails.username} size="xl" />
							<Tooltip>{playerDetails.username}</Tooltip>
							<div>
								<div class="flex items-center gap-2">
									<Heading tag="h3">{playerDetails.username}</Heading>
									{#if playerDetails.isAdmin}
										<Badge color="red">
											<iconify-icon icon="eos-icons:admin" class="h-3 w-3"></iconify-icon>
											Admin
										</Badge>
									{/if}
									{#if playerDetails.bannedAt}
										<Badge color="red">Banned</Badge>
									{:else}
										<Badge color="green">Active</Badge>
									{/if}
								</div>
								<p>
									Email: <span class="font-mono">
										{#await emailPromise}
											Loading...
										{:then email}
											{email || 'Not available'}
										{:catch}
											Error loading email
										{/await}
									</span><br />
									ID: <span class="font-mono">{playerDetails.id}</span><br />
									Joined <DateComponent date={playerDetails.createdAt} />
									• Last active {timeAgo(playerDetails.activity.lastActivity)}
								</p>
							</div>
						</div>
						<div class="action-buttons">
							{#if !playerDetails.isAdmin}
								<form method="POST" action="?/toggleBan" use:enhance>
									<input type="hidden" name="playerId" value={playerDetails.id} />
									<Button
										type="submit"
										class="ban-button {playerDetails.bannedAt ? 'unban' : 'ban'}"
									>
										<iconify-icon
											icon={playerDetails.bannedAt
												? 'material-symbols:person-check'
												: 'material-symbols:person-off'}
										></iconify-icon>
										{playerDetails.bannedAt ? 'Unban Player' : 'Ban Player'}
									</Button>
								</form>
								<Button color="red" onclick={() => (showDeleteModal = true)} class="delete-button">
									<iconify-icon icon="material-symbols:delete"></iconify-icon>
									Delete Player
								</Button>
							{/if}
						</div>
					</div>
				</div>
			</section>

			<!-- Activity Overview -->
			<div class="activity-grid">
				<div class="card-bg">
					<div class="text-center">
						<div>{playerDetails._count.turns}</div>
						<div>Total Turns</div>
					</div>
				</div>
				<div class="card-bg">
					<div class="text-center">
						<div>{playerDetails.activity.gamesParticipated}</div>
						<div>Games Played</div>
					</div>
				</div>
				<div class="card-bg">
					<div class="text-center">
						<div>{playerDetails.activity.completedGames}</div>
						<div>Completed Games</div>
					</div>
				</div>
				<div class="card-bg">
					<div class="text-center">
						<div>{playerDetails._count.favoritedBy}</div>
						<div>Favorited By</div>
					</div>
				</div>
			</div>

			<!-- Recent Activity -->
			<section>
				<div>
					<Heading tag="h2">Recent Activity</Heading>
				</div>
				<div class="recent-activity-grid">
					<div class="text-center">
						<div>{playerDetails.activity.recentTurns7d}</div>
						<div>Turns (Last 7 days)</div>
					</div>
					<div class="text-center">
						<div>{playerDetails.activity.recentTurns30d}</div>
						<div>Turns (Last 30 days)</div>
					</div>
					<div class="text-center">
						<div>{playerDetails._count.turnFlags}</div>
						<div>Flags Submitted</div>
					</div>
				</div>
			</section>

			<!-- Recent Turns -->
			{#if playerDetails.turns.length > 0}
				<section>
					<div>
						<Heading tag="h2">Recent Turns</Heading>
					</div>
					<Table hoverable={true}>
						<TableHead>
							<TableHeadCell>Game</TableHeadCell>
							<TableHeadCell>Type</TableHeadCell>
							<TableHeadCell>Completed</TableHeadCell>
							<TableHeadCell>Flags</TableHeadCell>
							<TableHeadCell>Actions</TableHeadCell>
						</TableHead>
						<TableBody>
							{#each playerDetails.turns as turn}
								<tr>
									<TableBodyCell>
										<a href="/g/{turn.game.id}" class="hover:underline">
											{turn.game.id}
										</a>
									</TableBodyCell>
									<TableBodyCell>
										<Badge color={turn.isDrawing ? 'blue' : 'green'}>
											<iconify-icon
												icon={turn.isDrawing ? 'material-symbols:draw' : 'material-symbols:edit'}
												class="h-3 w-3"
											></iconify-icon>
											{turn.isDrawing ? 'Drawing' : 'Writing'}
										</Badge>
									</TableBodyCell>
									<TableBodyCell>
										{#if turn.completedAt}
											<DateComponent date={turn.completedAt} />
										{:else}
											<Badge color="yellow">Pending</Badge>
										{/if}
									</TableBodyCell>
									<TableBodyCell>
										{#if turn.flags.length > 0}
											<Badge color="red"
												>{turn.flags.length} flag{turn.flags.length > 1 ? 's' : ''}</Badge
											>
										{:else}
											<span>None</span>
										{/if}
									</TableBodyCell>
									<TableBodyCell>
										<a href="/g/{turn.game.id}" class="view-button">
											<iconify-icon icon="material-symbols:visibility"></iconify-icon>
											View Game
										</a>
									</TableBodyCell>
								</tr>
							{/each}
						</TableBody>
					</Table>
				</section>
			{/if}

			<!-- Flag History -->
			{#if playerDetails.turnFlags.length > 0}
				<section>
					<div>
						<Heading tag="h2">Flags Submitted</Heading>
					</div>
					<Table hoverable={true}>
						<TableHead>
							<TableHeadCell>Flagged Turn</TableHeadCell>
							<TableHeadCell>Player</TableHeadCell>
							<TableHeadCell>Reason</TableHeadCell>
							<TableHeadCell>Date</TableHeadCell>
							<TableHeadCell>Status</TableHeadCell>
							<TableHeadCell>Actions</TableHeadCell>
						</TableHead>
						<TableBody>
							{#each playerDetails.turnFlags as flag}
								<tr>
									<TableBodyCell>
										<a href="/g/{flag.turn.game.id}" class="hover:underline">
											{flag.turn.game.id}
										</a>
									</TableBodyCell>
									<TableBodyCell>
										<a href="/p/{flag.turn.player.id}" class="hover:underline">
											{flag.turn.player.username}
										</a>
									</TableBodyCell>
									<TableBodyCell>
										<Badge color="yellow">{flag.reason}</Badge>
									</TableBodyCell>
									<TableBodyCell>
										<DateComponent date={flag.createdAt} />
									</TableBodyCell>
									<TableBodyCell>
										{#if flag.resolvedAt}
											<Badge color="green">Resolved</Badge>
										{:else}
											<Badge color="yellow">Pending</Badge>
										{/if}
									</TableBodyCell>
									<TableBodyCell>
										<a href="/g/{flag.turn.game.id}" class="view-button">
											<iconify-icon icon="material-symbols:visibility"></iconify-icon>
											View
										</a>
									</TableBodyCell>
								</tr>
							{/each}
						</TableBody>
					</Table>
				</section>
			{/if}

			<!-- About Me Section -->
			{#if playerDetails.aboutMe}
				<section>
					<div>
						<Heading tag="h2">About</Heading>
					</div>
					<div>
						<p>{playerDetails.aboutMe}</p>
					</div>
				</section>
			{/if}

			<!-- Player's Games -->
			{#if playerGames && playerGames.length > 0}
				<section>
					<div>
						<Heading tag="h2">Player's Games ({playerGames.length})</Heading>
					</div>
					<AdminGameTable gameList={playerGames} />
				</section>
			{:else}
				<section>
					<div>
						<Heading tag="h2">Player's Games</Heading>
						<p>This player has not participated in any games yet.</p>
					</div>
				</section>
			{/if}
		</div>

		<!-- Delete Confirmation Modal -->
		<Modal bind:open={showDeleteModal} size="sm" autoclose={false}>
			<div class="text-center">
				<iconify-icon icon="material-symbols:warning" class="mx-auto mb-4 h-14 w-14 text-danger-600"
				></iconify-icon>
				<h3 class="mb-5 text-lg font-normal text-primary-500 dark:text-primary-400">
					Are you sure you want to delete this player?
				</h3>
				<div class="mb-4 rounded-lg bg-danger-50 p-4 dark:bg-danger-900/20">
					<p class="text-sm text-danger-800 dark:text-danger-200">
						<strong>Warning:</strong> This action cannot be undone. Deleting this player will:
					</p>
					<ul class="list mt-2 text-left text-sm text-danger-700 dark:text-danger-300">
						<li>Permanently delete their account from both the database and Clerk</li>
						<li>Remove all their turns from games</li>
						<li>Delete all flags they've submitted</li>
						<li>Remove all their notifications and favorites</li>
						<li>Delete all comments they've made</li>
					</ul>
				</div>
				<div class="flex justify-center gap-4">
					<form
						method="POST"
						action="?/deletePlayer"
						use:enhance={() => {
							isDeleting = true;
							return async ({ update }) => {
								await update();
								isDeleting = false;
								showDeleteModal = false;
							};
						}}
					>
						<input type="hidden" name="playerId" value={playerDetails.id} />
						<Button type="submit" color="red" disabled={isDeleting} class="mr-2">
							{#if isDeleting}
								<iconify-icon icon="eos-icons:loading" class="mr-2 h-4 w-4 animate-spin"
								></iconify-icon>
								Deleting...
							{:else}
								<iconify-icon icon="material-symbols:delete" class="mr-2 h-4 w-4"></iconify-icon>
								Yes, Delete Player
							{/if}
						</Button>
					</form>
					<Button color="alternative" onclick={() => (showDeleteModal = false)} disabled={isDeleting}>
						Cancel
					</Button>
				</div>
			</div>
		</Modal>
	{/if}
</div>
<style lang="postcss">
	.content-container {
		@apply space-y-1;
	}

	.activity-grid {
		@apply grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4;
	}

	.recent-activity-grid {
		@apply grid grid-cols-1 gap-1 md:grid-cols-3; /* p-1 removed */
	}

	.action-buttons {
		@apply flex gap-1;
	}

	.view-button {
		@apply inline-flex items-center gap-1 hover:underline; /* px-1 py-1 text-sm text-blue-600 hover:text-blue-800 removed */
	}
</style>
