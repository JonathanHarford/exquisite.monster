<script lang="ts">
	import DateComponent from '$lib/components/DateComponent.svelte';
	import {
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyCell,
		Badge
	} from 'flowbite-svelte';
	import { type AdminUseCases } from '$lib/server/usecases/AdminUseCases';

	const {
		gameList
	}: {
		gameList: Awaited<ReturnType<typeof AdminUseCases.getGameListWithAnalytics>>;
	} = $props();
</script>

<div class="overflow-x-auto">
	<Table hoverable={true} striped={true}>
		<TableHead>
			<TableHeadCell>ID</TableHeadCell>
			<TableHeadCell>Status</TableHeadCell>
			<TableHeadCell>Created At</TableHeadCell>
			<TableHeadCell>Last Updated</TableHeadCell>
			<TableHeadCell>Expires At</TableHeadCell>
			<TableHeadCell>Turns</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each gameList as game (game.id)}
				<tr class:bg-danger-50={game.hasFlaggedTurns}>
					<TableBodyCell class="font-mono">
						<a
							href="/g/{game.id}"
							class="hover:underline"
							title="View details for game {game.id}"
						>
							{game.id}
						</a>
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-2">
							{#if game.hasFlaggedTurns}
								<Badge color="red">
									<iconify-icon icon="material-symbols:flag" class="h-3 w-3"></iconify-icon>
									Flagged
								</Badge>
							{:else if game.deletedAt}
								<Badge color="dark">
									<iconify-icon icon="material-symbols:delete" class="h-3 w-3"></iconify-icon>
									Killed
								</Badge>
							{:else if game.completedAt}
								<Badge color="green">Completed</Badge>
							{:else}
								<Badge color="blue">Active</Badge>
							{/if}
							{#if game.config.isLewd}
								<span title="18+ Content">🔞</span>
							{/if}
						</div>
					</TableBodyCell>
					<TableBodyCell>
						<DateComponent date={game.createdAt} />
					</TableBodyCell>
					<TableBodyCell>
						<DateComponent date={game.updatedAt} />
					</TableBodyCell>
					<TableBodyCell>
						{@const ineligibleForCompletion =
							game.completedAt || game.completedTurnsCount < game.config.minTurns}
						<div class={ineligibleForCompletion ? 'text-danger-800 line-through' : ''}>
							<DateComponent date={game.expiresAt} />
						</div>
					</TableBodyCell>
					<TableBodyCell>
						<span>
							{game.completedTurnsCount}
							{#if game.pendingTurn}+{/if}
						</span>
					</TableBodyCell>
				</tr>
			{/each}
		</TableBody>
	</Table>
</div>

{#if gameList.length === 0}
	<div class="text-center">
		<iconify-icon icon="material-symbols:gamepad-off" class="mx-auto h-12 w-12"></iconify-icon>
		<p>No games found</p>
	</div>
{/if}
