<script lang="ts">
	import DateComponent from '$lib/components/DateComponent.svelte';
	import {
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyCell,
		Badge,
		Progressbar
	} from 'flowbite-svelte';
	import type { AdminUseCases } from '$lib/server/usecases/AdminUseCases';

	const {
		partyList
	}: {
		partyList: Awaited<ReturnType<typeof AdminUseCases.getPartyList>>;
	} = $props();

	function getStatusColor(
		status: string
	):
		| 'none'
		| 'blue'
		| 'green'
		| 'red'
		| 'yellow'
		| 'purple'
		| 'indigo'
		| 'pink'
		| 'dark'
		| 'primary' {
		switch (status) {
			case 'active':
				return 'green';
			case 'open':
				return 'blue';
			case 'completed':
				return 'purple';
			case 'closed':
				return 'red';
			default:
				return 'dark';
		}
	}
</script>

<div class="overflow-x-auto">
	<Table hoverable={true} striped={true}>
		<TableHead>
			<TableHeadCell>Party</TableHeadCell>
			<TableHeadCell>Creator</TableHeadCell>
			<TableHeadCell>Created</TableHeadCell>
			<TableHeadCell># Players</TableHeadCell>
			<TableHeadCell>% Complete</TableHeadCell>
			<TableHeadCell>Status</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each partyList as party}
				<tr>
					<TableBodyCell>
						<a href="/s/{party.id}" class="hover:underline" title="View party {party.title}">
							{party.title}
						</a>
					</TableBodyCell>
					<TableBodyCell>
						<a
							href="/p/{party.creator.id}"
							class="hover:underline"
							title="View player {party.creator.username}"
						>
							{party.creator.username}
						</a>
					</TableBodyCell>
					<TableBodyCell>
						<DateComponent date={party.createdAt} />
					</TableBodyCell>
					<TableBodyCell>{party.playerCount}</TableBodyCell>
					<TableBodyCell>
						<Progressbar progress={party.completionPercentage.toFixed(0)} size="h-4" labelInside />
					</TableBodyCell>
					<TableBodyCell>
						<Badge color={getStatusColor(party.status)}>{party.status}</Badge>
					</TableBodyCell>
				</tr>
			{/each}
		</TableBody>
	</Table>
</div>

{#if partyList.length === 0}
	<div class="p-4 text-center">
		<iconify-icon icon="mdi:party-popper" class="mx-auto h-12 w-12"></iconify-icon>
		<p>No parties found</p>
	</div>
{/if}
