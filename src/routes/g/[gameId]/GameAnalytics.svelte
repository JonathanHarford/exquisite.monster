<script lang="ts">
	import { Badge } from 'flowbite-svelte';
	import DateComponent from '$lib/components/DateComponent.svelte';
	import type { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
	import { formatDuration, parseDuration } from '$lib/datetime';

	const {
		gameAnalytics
	}: {
		gameAnalytics: Awaited<ReturnType<typeof AdminUseCases.getGameDetails>>;
	} = $props();
</script>

{#if gameAnalytics}
	<div>
		<div class="border-b border-solid border-black">
			<h3>Game Analytics</h3>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
			<!-- Unique Players -->
			<div class="rounded-lg">
				<div class="flex items-center gap-2">
					<iconify-icon icon="material-symbols:group" class="h-5 w-5"></iconify-icon>
					<span>Unique Players</span>
				</div>
				<div>{gameAnalytics.analytics.uniquePlayers}</div>
			</div>

			<!-- Completion Rate -->
			<div class="rounded-lg">
				<div class="flex items-center gap-2">
					<iconify-icon icon="material-symbols:check-circle" class="h-5 w-5"></iconify-icon>
					<span>Completion Rate</span>
				</div>
				<div>{gameAnalytics.analytics.completionRate}%</div>
				<div>
					{gameAnalytics.analytics.completedTurns} of {gameAnalytics._count.turns} turns
				</div>
			</div>

			<!-- Game Duration -->
			<div class="rounded-lg">
				<div class="flex items-center gap-2">
					<iconify-icon icon="material-symbols:schedule" class="h-5 w-5"></iconify-icon>
					<span>Duration</span>
				</div>
				<div>
					{gameAnalytics.analytics.gameDurationHours}h
				</div>
				{#if gameAnalytics.analytics.avgTurnCompletionTimeHours > 0}
					<div>
						Avg turn: {gameAnalytics.analytics.avgTurnCompletionTimeHours}h
					</div>
				{/if}
			</div>

			<!-- Flagged Turns -->
			<div class="rounded-lg">
				<div class="flex items-center gap-2">
					<iconify-icon icon="material-symbols:flag" class="h-5 w-5"></iconify-icon>
					<span>Flagged Turns</span>
				</div>
				<div>{gameAnalytics.analytics.flaggedTurns}</div>
				{#if gameAnalytics.analytics.flaggedTurns > 0}
					<div>
						{Math.round((gameAnalytics.analytics.flaggedTurns / gameAnalytics._count.turns) * 100)}%
						of turns
					</div>
				{/if}
			</div>
		</div>

		<!-- Game Timeline -->
		<div>
			<h4>Game Timeline</h4>
			<div class="flex items-center gap-2">
				<Badge color="blue">Created</Badge>
				<DateComponent date={gameAnalytics.createdAt} />
				{#if gameAnalytics.completedAt}
					<iconify-icon icon="oi:chevron-right" class="h-3 w-3"></iconify-icon>
					<Badge color="green">Completed</Badge>
					<DateComponent date={gameAnalytics.completedAt} />
				{:else}
					<iconify-icon icon="oi:chevron-right" class="h-3 w-3"></iconify-icon>
					<Badge color="yellow">In Progress</Badge>
					<DateComponent date={gameAnalytics.updatedAt} />
				{/if}
			</div>
		</div>

		<!-- Game Configuration -->
		{#if gameAnalytics.config}
			<div>
				<h4>Game Configuration</h4>
				<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
					<div>
						<span>Min Turns:</span>
						<span>{gameAnalytics.config.minTurns}</span>
					</div>
					<div>
						<span>Max Turns:</span>
						<span>{gameAnalytics.config.maxTurns || 'Unlimited'}</span>
					</div>
					<div>
						<span>Writing Timeout:</span>
						<span>{formatDuration(parseDuration(gameAnalytics.config.writingTimeout))}</span>
					</div>
					<div>
						<span>Drawing Timeout:</span>
						<span>{formatDuration(parseDuration(gameAnalytics.config.drawingTimeout))}</span>
					</div>
					<div>
						<span>Game Timeout:</span>
						<span>{formatDuration(parseDuration(gameAnalytics.config.gameTimeout))}</span>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
