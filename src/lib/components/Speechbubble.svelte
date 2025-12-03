<script lang="ts">
	const {
		direction = 'left',
		clickable = false,
		onclick,
		onkeydown,
		className = '',
		children
	}: {
		direction?: 'left' | 'right';
		clickable?: boolean;
		onclick?: (event: MouseEvent) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		className?: string;
		children: import('svelte').Snippet;
	} = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (clickable && event.key === 'Enter' && onkeydown) {
			onkeydown(event);
		}
	}
</script>

{#if clickable}
	<div
		class="bubble {direction} clickable-bubble {className}"
		{onclick}
		onkeydown={handleKeydown}
		role="button"
		tabindex="0"
	>
		{@render children()}
	</div>
{:else}
	<div class="bubble {direction} {className}">
		{@render children()}
	</div>
{/if}

<style lang="postcss">
	.bubble {
		/* Speechbubble designed by Temani Afif */
		--r: 1em; /* the radius */
		--t: 1.5em; /* the size of the tail */
		font-family: 'script', sans-serif;
		@apply w-full text-center;
		border-inline: var(--t) solid #0000;
		border-radius: calc(var(--r) + var(--t)) / var(--r);
		mask:
			radial-gradient(100% 100% at var(--_p) 0, #0000 99%, #000 102%) var(--_p) 100% / var(--t)
				var(--t) no-repeat,
			linear-gradient(#000 0 0) padding-box;
		@apply border-primary-50 bg-gradient-to-br from-primary-50 to-warning-50;

		&.left {
			--_p: 0;
			border-bottom-left-radius: 0 0;
		}

		&.right {
			--_p: 100%;
			border-bottom-right-radius: 0 0;
			place-self: end;
		}
	}

	.clickable-bubble {
		@apply cursor-pointer transition-transform duration-200;

		&:hover {
			@apply scale-105 transform;
		}

		&:focus {
			@apply outline-none ring-2 ring-primary-500 ring-offset-2;
		}

		&:active {
			@apply scale-95 transform;
		}
	}

	/* Mobile touch feedback */
	@media (max-width: 640px) {
		.clickable-bubble:active {
			@apply scale-95 transform opacity-80;
		}
	}

	/* Reduce motion for users who prefer it */
	@media (prefers-reduced-motion: reduce) {
		.clickable-bubble {
			@apply transition-none;
		}

		.clickable-bubble:hover,
		.clickable-bubble:active {
			@apply transform-none;
		}
	}
</style>
