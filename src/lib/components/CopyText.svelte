<script lang="ts">
	let { copyText }: { copyText: string } = $props();
</script>

<div class="copy-text">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html copyText}
</div>

<style lang="postcss">
	/* :global is required to keep "unused" classes from being removed by postcss */

	.copy-text :global(p) {
		@apply my-1;
	}

	.copy-text :global(ol) {
		list-style-type: decimal;
	}
	.copy-text :global(ul) {
		list-style-type: disc;
	}
	.copy-text :global(ol),
	.copy-text :global(ul) {
		:global(> li) {
			list-style-position: inside;
			text-indent: -1em;
			padding-left: 1em;
		}
	}
</style>
