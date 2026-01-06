<script lang="ts">
	import { Badge, Spinner, Alert } from 'flowbite-svelte';
	import DateComponent from '$lib/components/DateComponent.svelte';
	import { resolve } from '$app/paths';
	import { getTrendingGames } from '../api/analytics.remote';

	interface TrendingGame {
		id: string;
		turns?: unknown[];
		createdAt: string | Date;
		completedAt?: string | Date | null;
		updatedAt?: string | Date;
		lastActivityAt?: string | Date;
		isComplete?: boolean;
		favCount?: number;
		viewCount?: number;
		score?: number;
		recentTurns?: number;
		uniquePlayers?: number;
		totalTurns?: number;
		_count?: {
			turns: number;
		};
		[key: string]: any;
	}

	interface TrendingData {
		mostActive: TrendingGame[];
		mostPlayers: TrendingGame[];
		recentlyCompleted: TrendingGame[];
		mostTurns: TrendingGame[];
	}

	let trendingPromise = $state(getTrendingGames() as Promise<TrendingData>);
</script>

<h3>Trending Games</h3>

{#await trendingPromise}
	<div class="flex items-center justify-center">
		<div class="text-center">
			<Spinner size="8" />
			<p>Loading trending games...</p>
			<p>Analyzing game activity</p>
		</div>
	</div>
{:then trendingData}
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Most Active Games -->
			<div class="rounded-xl border border-solid border-black">
				<h4 class=" flex items-center gap-2">
					<iconify-icon icon="material-symbols:trending-up" class="h-6 w-6"></iconify-icon>
					Most Active (Last 7 Days)
				</h4>
				{#if trendingData.mostActive && trendingData.mostActive.length > 0}
					<div class="space-y-3">
						{#each trendingData.mostActive.slice(0, 5) as game, index}
							<div
								class="flex items-center justify-between rounded-lg border border-solid border-black shadow-sm"
							>
								<div class="flex items-center gap-3">
									<div class="flex h-8 w-8 items-center justify-center rounded-full">
										{index + 1}
									</div>
									<div>
										<a href={resolve('/g/[gameId]', { gameId: game.id })} class="font-mono hover:underline">
											{game.id}
										</a>
										<div class="mt-1 flex items-center gap-2">
											<Badge color="green">{game.recentTurns} recent turns</Badge>
										</div>
									</div>
								</div>
								<div class="text-right">
									<DateComponent date={game.updatedAt || game.createdAt} />
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center">
						<iconify-icon icon="material-symbols:sentiment-neutral" class="h-12 w-12"></iconify-icon>
						<p>No active games in the last 7 days</p>
					</div>
				{/if}
			</div>

			<!-- Games with Most Players -->
			<div class="rounded-xl border border-solid border-black">
				<h4 class=" flex items-center gap-2">
					<iconify-icon icon="material-symbols:group" class="h-6 w-6"></iconify-icon>
					Most Players
				</h4>
				{#if trendingData.mostPlayers && trendingData.mostPlayers.length > 0}
					<div class="space-y-3">
						{#each trendingData.mostPlayers.slice(0, 5) as game, index}
							<div
								class="flex items-center justify-between rounded-lg border border-solid border-black shadow-sm"
							>
								<div class="flex items-center gap-3">
									<div class="flex h-8 w-8 items-center justify-center rounded-full">
										{index + 1}
									</div>
									<div>
										<a href={resolve('/g/[gameId]', { gameId: game.id })} class="font-mono hover:underline">
											{game.id}
										</a>
										<div class="mt-1 flex items-center gap-2">
											<Badge color="blue">{game.uniquePlayers} players</Badge>
										</div>
									</div>
								</div>
								<div class="text-right">
									<span>{game.totalTurns}</span> turns
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center">
						<iconify-icon icon="material-symbols:sentiment-neutral" class="h-12 w-12"></iconify-icon>
						<p>No games with multiple players</p>
					</div>
				{/if}
			</div>

			<!-- Recently Completed Games -->
			<div class="rounded-xl border border-solid border-black">
				<h4 class=" flex items-center gap-2">
					<iconify-icon icon="material-symbols:check-circle" class="h-6 w-6"></iconify-icon>
					Recently Completed
				</h4>
				{#if trendingData.recentlyCompleted && trendingData.recentlyCompleted.length > 0}
					<div class="space-y-3">
						{#each trendingData.recentlyCompleted.slice(0, 5) as game, index}
							<div
								class="flex items-center justify-between rounded-lg border border-solid border-black shadow-sm"
							>
								<div class="flex items-center gap-3">
									<div class="flex h-8 w-8 items-center justify-center rounded-full">
										{index + 1}
									</div>
									<div>
										<a href={resolve('/g/[gameId]', { gameId: game.id })} class="font-mono hover:underline">
											{game.id}
										</a>
										<div class="mt-1 flex items-center gap-2">
											<Badge color="green">Completed</Badge>
										</div>
									</div>
								</div>
								<div class="text-right">
									<span>{game._count?.turns || 0}</span> turns
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center">
						<iconify-icon icon="material-symbols:sentiment-neutral" class="h-12 w-12"></iconify-icon>
						<p>No recently completed games</p>
					</div>
				{/if}
			</div>

			<!-- Games with Most Turns -->
			<div class="rounded-xl border border-solid border-black">
				<h4 class=" flex items-center gap-2">
					<iconify-icon icon="material-symbols:format-list-numbered" class="h-6 w-6"></iconify-icon>
					Most Turns
				</h4>
				{#if trendingData.mostTurns && trendingData.mostTurns.length > 0}
					<div class="space-y-3">
						{#each trendingData.mostTurns.slice(0, 5) as game, index}
							<div
								class="flex items-center justify-between rounded-lg border border-solid border-black shadow-sm"
							>
								<div class="flex items-center gap-3">
									<div class="flex h-8 w-8 items-center justify-center rounded-full">
										{index + 1}
									</div>
									<div>
										<a href={resolve('/g/[gameId]', { gameId: game.id })} class="font-mono hover:underline">
											{game.id}
										</a>
										<div class="mt-1 flex items-center gap-2">
											<Badge color="purple">{game._count?.turns || 0} turns</Badge>
										</div>
									</div>
								</div>
								<div class="text-right">
									{#if game.completedAt}
										<Badge color="green">Completed</Badge>
									{:else}
										<Badge color="yellow">Active</Badge>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center">
						<iconify-icon icon="material-symbols:sentiment-neutral" class="h-12 w-12"></iconify-icon>
						<p>No games with multiple turns</p>
					</div>
				{/if}
			</div>
		</div>
{:catch error}
	<Alert>
		<div class="flex items-center">
			<iconify-icon icon="material-symbols:error" class="h-5 w-5"></iconify-icon>
			<div class="flex-1">
				<h3>Trending Games Error</h3>
				<p>{error instanceof Error ? error.message : 'Unknown error'}</p>
			</div>
			<button type="button" class="btn btn-primary" onclick={() => (trendingPromise = getTrendingGames() as Promise<TrendingData>)}>
				<iconify-icon icon="material-symbols:refresh" class="h-4 w-4"></iconify-icon>
				Retry
			</button>
		</div>
	</Alert>
{/await}

<style lang="postcss">
	/* Enhanced hover effects for game items */
	:global(.trending-games .game-item:hover) {
		@apply scale-105 transform shadow-lg transition-all duration-200;
	}

	/* Smooth transitions for all interactive elements */
	:global(.trending-games a:hover) {
		@apply transition-colors duration-200;
	}
</style>
