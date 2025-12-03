<script lang="ts">
	interface Party {
		id: string;
		title: string;
		status: string;
		createdAt: Date;
		playerCount: number;
		hasPendingTurn: boolean;
	}

	interface Props {
		parties: Party[];
	}

	let { parties }: Props = $props();

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString();
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'open':
				return 'text-primary-600';
			case 'active':
				return 'text-success-600';
			case 'completed':
				return 'text-gray-600';
			default:
				return 'text-gray-600';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'open':
				return 'Open';
			case 'active':
				return 'Active';
			case 'completed':
				return 'Completed';
			default:
				return status;
		}
	}
</script>

<table class="party-table">
	<thead>
		<tr>
			<th>Title</th>
			<th>Status</th>
			<th>Start Date</th>
			<th>Players</th>
		</tr>
	</thead>
	<tbody>
		{#each parties as party}
			<tr class:pending-turn={party.hasPendingTurn}>
				<td>
					<a href="/s/{party.id}" class="party-link">
						{party.title}
					</a>
				</td>
				<td>
					<span class="party-status {getStatusColor(party.status)}">
						{getStatusLabel(party.status)}
						{#if party.hasPendingTurn}
							<span class="pending-indicator">•</span>
						{/if}
					</span>
				</td>
				<td>{formatDate(party.createdAt)}</td>
				<td>{party.playerCount}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style lang="postcss">
	.party-table {
		@apply w-full;
	}

	.party-table th {
		@apply border-b border-gray-200 px-4 py-3 text-left text-sm;
	}

	.party-table td {
		@apply border-b border-gray-100 px-4 py-3 text-left text-sm;
	}

	.party-table tr:hover {
		@apply bg-gray-50;
	}

	.pending-turn {
		@apply bg-danger-50;
		animation: glow 2s ease-in-out infinite alternate;
	}

	.pending-turn:hover {
		@apply bg-danger-100;
	}

	.party-link {
		@apply font-medium text-primary-600 no-underline hover:text-primary-800;
	}

	.party-status {
		@apply font-medium;
	}

	.pending-indicator {
		@apply ml-2 text-danger-500;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes glow {
		from {
			background-color: rgb(254 226 226);
		}
		to {
			background-color: rgb(252 165 165);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	/* Reduce motion for users who prefer it */
	@media (prefers-reduced-motion: reduce) {
		.pending-turn,
		.pending-indicator {
			animation: none;
		}
	}
</style>
