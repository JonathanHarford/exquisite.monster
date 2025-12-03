<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import GameGallery from './GameGallery.svelte';
	import { CardPlaceholder, ButtonGroup, Button, Toggle } from 'flowbite-svelte';
	import type { GameWithTurns, Player } from '$lib/types/domain';

	// Props from page data
	interface Props {
		games: GameWithTurns[];
		hasMore: boolean;
		total: number;
		currentPage: number;
		limit: number;
		filter: string;
		self?: Player;
	}

	let { games, hasMore, currentPage, limit }: Props = $props();

	// Derive current filter from URL to ensure it's always up to date
	let currentFilter = $derived(page.url.searchParams.get('filter') || 'best-all');

	// Filter options
	type FilterOption = 'best-7' | 'best-30' | 'best-all' | 'latest';

	let loading = $state(false);

	// Reset loading state after navigation completes
	afterNavigate(() => {
		loading = false;
	});

	const filterOptions = [
		{ value: 'best-7' as const, label: 'Best last 7 days' },
		{ value: 'best-30' as const, label: 'Best last 30 days' },
		{ value: 'best-all' as const, label: 'Best all time' },
		{ value: 'latest' as const, label: 'Latest' }
	];

	async function changeFilter(newFilter: FilterOption) {
		if (newFilter === currentFilter) return;

		loading = true;
		const url = new URL(page.url);
		url.searchParams.set('filter', newFilter);
		url.searchParams.set('page', '1');
		await goto(url.toString());
		// Note: loading will be reset to false by afterNavigate callback
	}

	async function loadMore() {
		if (loading || !hasMore) return;

		loading = true;
		const url = new URL(page.url);
		url.searchParams.set('page', (currentPage + 1).toString());
		await goto(url.toString());
		// Note: loading will be reset to false by afterNavigate callback
	}
</script>

<div class="game-gallery-filtered">
	<!-- Filter Controls -->
	<div class="filter-controls mb-4 flex items-center justify-center gap-4">
		<ButtonGroup>
			{#each filterOptions as option}
				{@const isActive = currentFilter === option.value}
				<Button
					color={isActive ? 'primary' : 'alternative'}
					onclick={() => changeFilter(option.value)}
					disabled={loading}
				>
					{option.label}
				</Button>
			{/each}
		</ButtonGroup>
	</div>

	<!-- Games Gallery -->
	{#if loading}
		<!-- Skeleton Loading State -->
		<div class="skeleton-gallery">
			{#each Array(Math.min(limit || 20, 12)) as _}
				<CardPlaceholder divClass="skeleton-card" />
			{/each}
		</div>
	{:else}
		<GameGallery
			{games}
			{hasMore}
			{loading}
			{loadMore}
			emptyMessage="Try selecting a different filter to see more games."
		/>
	{/if}
</div>

<style lang="postcss">
	.game-gallery-filtered {
		@apply w-full;
	}

	/* Skeleton Gallery Layout */
	.skeleton-gallery {
		@apply grid gap-4;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	:global(.skeleton-card) {
		@apply w-full;
	}

	/* Mobile responsiveness for skeleton */
	@media (max-width: 640px) {
		.skeleton-gallery {
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			@apply gap-3;
		}
	}
</style>
