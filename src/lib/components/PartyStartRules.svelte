<script lang="ts">
	interface Props {
		minPlayers: number;
		maxPlayers?: number;
		startDeadline?: string; // ISO datetime string
		currentPlayerCount: number;
	}

	let { minPlayers, maxPlayers, startDeadline, currentPlayerCount }: Props = $props();

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric'
		});
	};

	const formatTime = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	};

	const playersNeeded = $derived(Math.max(0, minPlayers - currentPlayerCount));
	const playersUntilMax = $derived(maxPlayers ? Math.max(0, maxPlayers - currentPlayerCount) : 0);
	const hasEnoughPlayers = $derived(currentPlayerCount >= minPlayers);

	const startRulesText = $derived(
		// No deadline set
		!startDeadline
			? playersNeeded === 0
				? 'The party will start immediately.'
				: `The party will start once ${playersNeeded} more player${playersNeeded === 1 ? '' : 's'} ${playersNeeded === 1 ? 'has' : 'have'} joined.`
			: // Has deadline
				hasEnoughPlayers
				? maxPlayers && playersUntilMax > 0
					? `The party will start at ${formatDate(startDeadline)} ${formatTime(startDeadline)}, or after ${playersUntilMax} more player${playersUntilMax === 1 ? '' : 's'} ${playersUntilMax === 1 ? 'has' : 'have'} joined.`
					: `The party will start at ${formatDate(startDeadline)} ${formatTime(startDeadline)}.`
				: `The party will start after ${formatDate(startDeadline)} ${formatTime(startDeadline)}, once ${playersNeeded} more player${playersNeeded === 1 ? '' : 's'} ${playersNeeded === 1 ? 'has' : 'have'} joined.`
	);
</script>

<p class="text-sm">
	{startRulesText}
</p>
