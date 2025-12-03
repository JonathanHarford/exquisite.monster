<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';
	let { children }: { children: Snippet } = $props();

	let container = $state<HTMLElement | null>(null);
	let fullLengthContainer = $state<HTMLElement | null>(null);

	let fontSize = $state(10);

	let resizeObserver: ResizeObserver | null = null;
	onMount(() => {
		if (browser && container) {
			resizeObserver = new ResizeObserver(() => {
				const width = container?.offsetWidth ?? 0;
				fontSize = Math.min(120, (6 * width) / (fullLengthContainer?.offsetWidth ?? 1));
			});
			resizeObserver.observe(container);
		}
	});

	onDestroy(() => {
		if (resizeObserver && container) {
			resizeObserver.unobserve(container);
		}
	});
</script>

<div>
	{fullLengthContainer?.offsetWidth}
	{container?.offsetWidth}
	{fontSize}
</div>
<div class="flex flex-col items-center">
	<div class="full-length-container" bind:this={fullLengthContainer}>{@render children?.()}</div>
</div>
<div class="container" bind:this={container} style="font-size: {fontSize}px;">
	{@render children?.()}
</div>

<style lang="postcss">
	.full-length-container {
		white-space: nowrap;
		font-size: 1px;
		@apply bg-primary-500;
	}
	.container {
		display: flex;
		align-items: center;
		aspect-ratio: 1 / 1;
		overflow-y: hidden;
		text-align: justify;
	}
</style>
