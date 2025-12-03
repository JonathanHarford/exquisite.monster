<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import GameCard from './GameCard.svelte';
	import type { GameWithTurns } from '$lib/types/domain';

	// Props
	interface Props {
		games: GameWithTurns[];
		hasMore?: boolean;
		loading?: boolean;
		loadMore?: () => void;
		emptyMessage?: string;
	}

	let {
		games,
		hasMore = false,
		loading = false,
		loadMore,
		emptyMessage = 'No games found'
	}: Props = $props();

	// Loading skeleton component
	function LoadingSkeleton() {
		return Array.from({ length: 6 }, (_, i) => i);
	}
</script>

<div class="game-gallery">
	<!-- Games Grid -->
	<div class="games-grid">
		{#each games as game (game.id)}
			<GameCard {game} />
		{/each}

		<!-- Loading Skeletons -->
		{#if loading && games.length === 0}
			{#each LoadingSkeleton() as _, i (i)}
				<Card class="game-card">
					<div class="skeleton-content">
						<div class="skeleton-image"></div>
						<div class="skeleton-info">
							<div class="skeleton-text skeleton-text-short"></div>
							<div class="skeleton-text skeleton-text-long"></div>
						</div>
					</div>
				</Card>
			{/each}
		{/if}
	</div>

	<!-- Loading State for pagination -->
	{#if loading && games.length > 0}
		<div class="loading-state">
			<div class="flex items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500"></div>
				<span>Loading more games...</span>
			</div>
		</div>
	{/if}

	<!-- Load More Button -->
	{#if !loading && hasMore && games.length > 0 && loadMore}
		<div class="load-more-container">
			<button class="btn btn-primary load-more-btn" onclick={loadMore} aria-label="Load more games">
				Load More Games
			</button>
		</div>
	{/if}

	<!-- Empty State -->
	{#if !loading && games.length === 0}
		<div class="empty-state">
			<iconify-icon icon="material-symbols:search-off"></iconify-icon>
			<p class="text-center">No games found</p>
			<p class="text-center">
				{emptyMessage}
			</p>
		</div>
	{/if}
</div>

<style lang="postcss">
	.game-gallery {
		@apply w-full;
	}

	.games-grid {
		@apply grid gap-4;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	.load-more-container {
		@apply flex justify-center;
	}

	.empty-state {
		@apply flex flex-col items-center justify-center text-center;
	}

	/* Loading Skeletons */
	.skeleton-content {
		@apply animate-pulse;
	}

	.skeleton-image {
		@apply aspect-square rounded-t-lg;
	}

	.skeleton-info {
		@apply space-y-2;
	}

	.skeleton-text {
		@apply h-4 rounded;
	}

	.skeleton-text-short {
		@apply w-1/3;
	}

	.skeleton-text-long {
		@apply w-2/3;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.games-grid {
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			@apply gap-3;
		}
	}

	/* Reduce motion for users who prefer it */
	@media (prefers-reduced-motion: reduce) {
		.skeleton-content {
			@apply animate-none;
		}
	}
</style>
