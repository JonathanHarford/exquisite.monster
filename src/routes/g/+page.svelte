<script lang="ts">
	import GameGalleryFiltered from '$lib/components/GameGalleryFiltered.svelte';
	import type { PageProps } from './$types';
	import SEO from '$lib/components/SEO.svelte';
	const { data }: PageProps = $props();
</script>

<SEO
	title="Game Gallery"
	description="Explore completed games and see how sentences transform into drawings and back again. Browse the funniest and most creative chains of artistic telephone."
/>

<div class="container mx-auto">
	<h2>Game Gallery</h2>
	<GameGalleryFiltered
		games={data.games || []}
		hasMore={data.hasMore || false}
		total={data.total || 0}
		currentPage={data.currentPage || 1}
		limit={data.limit || 20}
		filter={data.filter || 'best-all'}
		self={data.self}
	/>
</div>
