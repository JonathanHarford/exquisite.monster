<script lang="ts">
	import DateComponent from '$lib/components/DateComponent.svelte';
	import type { GameWithTurns } from '$lib/types/domain';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Avatar } from 'flowbite-svelte';

	const {
		game,
		currentTurnIndex,
		isOpen,
		onClose,
		onNavigate
	}: {
		game: GameWithTurns;
		currentTurnIndex: number;
		isOpen: boolean;
		onClose: () => void;
		onNavigate: (index: number) => void;
	} = $props();

	let currentTurn = $derived(game.turns[currentTurnIndex]);
	let canGoPrevious = $derived(currentTurnIndex > 0);
	let canGoNext = $derived(currentTurnIndex < game.turns.length - 1);

	// Animation state
	let slideDirection = $state<'left' | 'right' | null>(null);
	let animationKey = $state(0);

	// Touch handling for swipe gestures
	let touchStartX = 0;
	let touchStartY = 0;
	let touchEndX = 0;
	let touchEndY = 0;
	const minSwipeDistance = 50;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
		touchStartY = e.changedTouches[0].screenY;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		touchEndY = e.changedTouches[0].screenY;
		handleSwipe();
	}

	function navigateWithAnimation(newIndex: number) {
		if (newIndex < currentTurnIndex) {
			slideDirection = 'right'; // Previous turn slides in from right
		} else if (newIndex > currentTurnIndex) {
			slideDirection = 'left'; // Next turn slides in from left
		}
		animationKey += 1; // Force re-render for transition
		onNavigate(newIndex);
	}

	function handleSwipe() {
		const deltaX = touchEndX - touchStartX;
		const deltaY = touchEndY - touchStartY;

		// Only handle horizontal swipes (ignore vertical scrolling)
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
			if (deltaX > 0 && canGoPrevious) {
				// Swipe right - go to previous turn
				navigateWithAnimation(currentTurnIndex - 1);
			} else if (deltaX < 0 && canGoNext) {
				// Swipe left - go to next turn
				navigateWithAnimation(currentTurnIndex + 1);
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) return;

		switch (e.key) {
			case 'ArrowLeft':
				e.preventDefault();
				if (canGoPrevious) {
					navigateWithAnimation(currentTurnIndex - 1);
				}
				break;
			case 'ArrowRight':
				e.preventDefault();
				if (canGoNext) {
					navigateWithAnimation(currentTurnIndex + 1);
				}
				break;
			case 'Escape':
				e.preventDefault();
				onClose();
				break;
		}
	}

	onMount(() => {
		// Add keyboard event listener when component mounts
		document.addEventListener('keydown', handleKeydown);

		return () => {
			// Clean up event listener
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if isOpen}
	<div
		class="lightbox-overlay"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Enter' && onClose()}
		role="dialog"
		aria-label="Turn lightbox"
		tabindex="-1"
	>
		<div
			class="lightbox-content"
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Enter' && e.stopPropagation()}
			role="presentation"
		>
			<!-- Navigation arrows -->
			{#if canGoPrevious}
				<button
					class="nav-arrow nav-arrow-left"
					onclick={() => navigateWithAnimation(currentTurnIndex - 1)}
					aria-label="Previous turn"
				>
					<iconify-icon icon="material-symbols:chevron-left" class="text-4xl"></iconify-icon>
				</button>
			{/if}

			{#if canGoNext}
				<button
					class="nav-arrow nav-arrow-right"
					onclick={() => navigateWithAnimation(currentTurnIndex + 1)}
					aria-label="Next turn"
				>
					<iconify-icon icon="material-symbols:chevron-right" class="text-4xl"></iconify-icon>
				</button>
			{/if}

			<!-- Turn content -->
			<div class="turn-display">
				{#key animationKey}
					<div
						class="turn-content-wrapper"
						in:fly={{
							x: slideDirection === 'left' ? 300 : slideDirection === 'right' ? -300 : 0,
							duration: 300,
							easing: quintOut
						}}
						out:fly={{
							x: slideDirection === 'left' ? -300 : slideDirection === 'right' ? 300 : 0,
							duration: 300,
							easing: quintOut
						}}
					>
						{#if currentTurn.isDrawing && currentTurn.player}
							<div class="drawing-container">
								<img
									src={currentTurn.content}
									alt="Drawing by {currentTurn.player.username}"
									class="lightbox-image bg-white"
								/>
							</div>
						{:else}
							<div class="writing-container">
								<p class="lightbox-text">{currentTurn.content}</p>
							</div>
						{/if}
					</div>
				{/key}
			</div>

			<!-- Turn info -->
			<div class="turn-info">
				{#if currentTurn.player}
					<div class="player-info">
						<Avatar src={currentTurn.player.imageUrl} data-name={currentTurn.player.username} />
						<div class="player-details">
							<div class="player-name">{currentTurn.player.username}</div>
							<div class="turn-meta">
								<DateComponent date={currentTurn.createdAt} />
								• Turn #{currentTurn.orderIndex + 1}
							</div>
						</div>
					</div>
				{/if}

				<button class="close-button-x" onclick={onClose} aria-label="Close lightbox">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"
						/></svg
					>
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
	.lightbox-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.85);
		z-index: 50;
		@apply flex items-center justify-center;
	}

	.lightbox-content {
		@apply relative flex h-full w-full flex-col items-center justify-center;
		max-width: 100vw;
		max-height: 100vh;
		padding: 1rem;
	}

	.nav-arrow {
		@apply absolute top-1/2 z-10 -translate-y-1/2 transform;
		@apply rounded-full bg-black bg-opacity-50 p-2 text-white;
		@apply transition-all duration-200 hover:bg-opacity-70;
		@apply flex h-12 w-12 items-center justify-center;
	}

	.nav-arrow-left {
		@apply left-4;
	}

	.nav-arrow-right {
		@apply right-4;
	}

	.turn-display {
		@apply flex w-full flex-1 items-center justify-center;
		/* Reserve space for turn info and navigation hint */
		max-height: calc(100vh - 8rem);
		position: relative;
		overflow: hidden;
	}

	.turn-content-wrapper {
		@apply flex h-full w-full items-center justify-center;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	.drawing-container {
		@apply flex h-full w-full items-center justify-center;
		max-width: 100vw;
		max-height: 100%;
	}

	.lightbox-image {
		max-width: calc(100vw - 2rem);
		max-height: calc(100vh - 8rem);
		width: auto;
		height: auto;
		object-fit: contain;
		@apply rounded-lg shadow-lg;
	}

	.writing-container {
		@apply max-w-2xl rounded-lg bg-white p-8 shadow-lg;
	}

	.lightbox-text {
		@apply text-center text-2xl md:text-3xl;
		font-family: 'script', sans-serif;
	}

	.turn-info {
		@apply mt-4 flex w-full items-center justify-between p-4;
		@apply rounded-lg bg-black bg-opacity-50 text-white;
		max-width: calc(100vw - 2rem);
	}

	.player-info {
		@apply flex items-center gap-3;
	}

	.player-details {
		@apply flex flex-col;
	}

	.player-name {
		@apply font-semibold;
	}

	.turn-meta {
		@apply text-sm opacity-80;
	}

	.close-button-x {
		background: none;
		border: none;
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.lightbox-content {
			padding: 0.5rem;
		}

		.turn-display {
			max-height: calc(100vh - 6rem);
		}

		.turn-content-wrapper {
			position: absolute;
		}

		.lightbox-image {
			max-width: calc(100vw - 1rem);
			max-height: calc(100vh - 6rem);
		}

		.nav-arrow {
			@apply h-10 w-10 text-2xl;
		}

		.nav-arrow-left {
			@apply left-2;
		}

		.nav-arrow-right {
			@apply right-2;
		}

		.lightbox-text {
			@apply p-4 text-xl;
		}

		.turn-info {
			@apply p-2 text-sm;
			max-width: calc(100vw - 1rem);
		}
	}

	/* Reduce motion for users who prefer it */
	@media (prefers-reduced-motion: reduce) {
		.nav-arrow {
			@apply transition-none;
		}
	}
</style>
