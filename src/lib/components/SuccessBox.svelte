<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<aside
	class="alert alert-success variant-ghost-success flex flex-col items-center rounded-md border border-solid border-black shadow-md"
>
	<iconify-icon icon="icon-park-outline:success" width="1em"></iconify-icon>
	<div>
		{@render children?.()}
	</div>
</aside>

<style lang="postcss">
	.alert-success {
		animation: pulse 1s ease-out;
		@apply bg-success-100;
	}

	@keyframes pulse {
		0% {
			@apply bg-success-300;
		}

		100% {
			@apply bg-success-100;
		}
	}
</style>
