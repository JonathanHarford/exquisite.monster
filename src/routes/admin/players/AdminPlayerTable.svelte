<script lang="ts">
	import DateComponent from '$lib/components/DateComponent.svelte';
	import {
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyCell,
		Badge,
		Avatar,
		Tooltip
	} from 'flowbite-svelte';
	import type { AdminUseCases } from '$lib/server/usecases/AdminUseCases';

	const {
		playerList
	}: {
		playerList: Awaited<ReturnType<typeof AdminUseCases.getPlayerList>>;
	} = $props();
</script>

<div class="overflow-x-auto">
	<Table hoverable={true} striped={true}>
		<TableHead>
			<TableHeadCell>Player</TableHeadCell>
			<TableHeadCell>Username</TableHeadCell>
			<TableHeadCell>Joined</TableHeadCell>
			<TableHeadCell>Last Login</TableHeadCell>
			<TableHeadCell>Status</TableHeadCell>
			<TableHeadCell>Turns</TableHeadCell>
			<TableHeadCell>Flags</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each playerList as p}
				<tr>
					<TableBodyCell>
						<Avatar src={p.imageUrl} data-name={p.username} size="sm" />
						<Tooltip>{p.username}</Tooltip>
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-2">
							{#if p.isAdmin}
								<Badge color="red">
									<iconify-icon icon="eos-icons:admin" class="mr-1 h-3 w-3"></iconify-icon>
									Admin
								</Badge>
							{/if}
							<a
								href="/p/{p.id}"
								class="hover:underline"
								title="View details for player {p.username}"
							>
								{p.username}
							</a>
						</div>
					</TableBodyCell>
					<TableBodyCell>
						<DateComponent date={p.createdAt} />
					</TableBodyCell>
					<TableBodyCell>
						<DateComponent date={p.lastActiveAt} />
					</TableBodyCell>
					<TableBodyCell>
						{#if p.bannedAt}
							<Badge color="red">Banned</Badge>
						{:else}
							<Badge color="green">Active</Badge>
						{/if}
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-1" title="{p._count.turns} Turns">
							<iconify-icon icon="material-symbols:draw" class="h-4 w-4"></iconify-icon>
							<span>{p._count.turns}</span>
						</div>
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-1" title="{p._count.turnFlags} Turn Flags">
							<iconify-icon icon="material-symbols:flag" class="h-4 w-4"></iconify-icon>
							<span>{p._count.turnFlags}</span>
						</div>
					</TableBodyCell>
				</tr>
			{/each}
		</TableBody>
	</Table>
</div>

{#if playerList.length === 0}
	<div class="text-center">
		<iconify-icon icon="material-symbols:person-off" class="mx-auto h-12 w-12"></iconify-icon>
		<p>No players found</p>
	</div>
{/if}
