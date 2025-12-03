<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<aside
	class="alert alert-error variant-ghost-error flex flex-col items-center rounded-md shadow-md p-1"
>
	<iconify-icon icon="ic:twotone-error" width="1em"></iconify-icon>
	<div>
		{@render children?.()}
	</div>
</aside>

<style lang="postcss">
	.alert-error {
		animation: pulse 1s ease-out;
		@apply bg-danger-100;
	}

	@keyframes pulse {
		0% {
			@apply bg-danger-300;
		}

		100% {
			@apply bg-danger-100;
		}
	}
</style>
