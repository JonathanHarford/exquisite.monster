<script lang="ts">
	import AnalyticsDashboard from './AnalyticsDashboard.svelte';
	import TrendingGames from '../TrendingGames.svelte';
	import { Heading } from 'flowbite-svelte';
</script>

<svelte:head>
	<title>Analytics - Admin Dashboard</title>
</svelte:head>

<div class="analytics-page">
	<div>
		<Heading tag="h3">Analytics & Insights</Heading>
		<p>Comprehensive analytics and trending data for your platform</p>
	</div>

	<div class="grid gap-6">
		<!-- Core Analytics -->
		<AnalyticsDashboard />

		<!-- Trending Games -->
		<TrendingGames />
	</div>
</div>

<style lang="postcss">
	.analytics-page {
		@apply mx-auto max-w-7xl;
	}
</style>
