<script lang="ts">
	import DateComponent from '$lib/components/DateComponent.svelte';
	import type { GameWithTurns } from '$lib/types/domain';
	import Debug from './Debug.svelte';
	import TurnLightbox from './TurnLightbox.svelte';
	import Comments from './Comments.svelte';
	import Speechbubble from './Speechbubble.svelte';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { scale, fly } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';
	import { Avatar } from 'flowbite-svelte';
	import { SignedIn } from 'svelte-clerk';
	import type { Comment } from '$lib/types/domain';
	import FavoriteButton from './FavoriteButton.svelte';
	import ShareButton from './ShareButton.svelte';
	import FlagTurnModal from './FlagTurnModal.svelte';
	import { flagTurnSchema } from '$lib/formSchemata';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { z } from 'zod/v4';
	import { PUBLIC_SITE_TITLE } from '$env/static/public';

	interface PresentationStep {
		idx: number;
		duration: number;
		markdown: string;
	}

	const {
		game,
		comments: commentsFromProps,
		isAdmin = false,
		className,
		presentation,
		showComments = true,
		showDates = true,
		showCompletedDate = true,
		isFavorited = false,
		favoriteCount = 0,
		showFlagButtons = false,
		flagTurnForm
	}: {
		game: GameWithTurns;
		comments?: Comment[];
		isAdmin?: boolean;
		className?: string;
		presentation?: PresentationStep[];
		showComments?: boolean;
		showDates?: boolean;
		showCompletedDate?: boolean;
		isFavorited?: boolean;
		favoriteCount?: number;
		showFlagButtons?: boolean;
		flagTurnForm?: SuperValidated<z.infer<typeof flagTurnSchema>>;
	} = $props();

	// Lightbox state
	let lightboxOpen = $state(false);
	let currentLightboxIndex = $state(0);

	// const clerk = useClerkContext(); // Unused

	// Presentation state
	let presentationActive = $state(false);
	let currentPresentationStep = $state(0);
	let presentationContainer: HTMLDivElement;
	let popupPosition = $state({ x: 0, y: 0, visible: false });

	function openLightbox(turnIndex: number) {
		currentLightboxIndex = turnIndex;
		lightboxOpen = true;
	}

	function closeLightbox() {
		lightboxOpen = false;
	}

	function navigateToTurn(turnIndex: number) {
		currentLightboxIndex = turnIndex;
	}

	function startPresentation() {
		if (!presentation || presentation.length === 0) return;

		presentationActive = true;
		currentPresentationStep = 0;

		// Position popup for first step
		positionPopup(presentation[0]);

		// Auto-advance through presentation steps
		const advanceStep = () => {
			if (currentPresentationStep < presentation.length - 1) {
				currentPresentationStep++;

				// Position popup for current step
				const currentStep = presentation[currentPresentationStep];
				positionPopup(currentStep);

				setTimeout(advanceStep, currentStep.duration);
			} else {
				// Presentation finished
				presentationActive = false;
				popupPosition.visible = false;
			}
		};

		// Start the first step
		const firstStep = presentation[0];
		setTimeout(advanceStep, firstStep.duration);
	}

	function scrollToTurn(turnIndex: number) {
		const turnElement = presentationContainer?.querySelector(`[data-testid="turn-${turnIndex}"]`);
		if (turnElement) {
			turnElement.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
		}
	}

	function positionPopup(step: PresentationStep) {
		if (!presentationContainer) return;

		let targetTurnIndex = step.idx;

		// Handle idx -1 as the last turn
		if (targetTurnIndex === -1) {
			targetTurnIndex = game.turns.length - 1;
		}

		// Find the target turn element
		const turnElement = presentationContainer.querySelector(
			`[data-testid="turn-${targetTurnIndex}"]`
		);

		if (turnElement) {
			// First, hide the popup
			popupPosition = { ...popupPosition, visible: false };

			// Scroll to the turn first
			scrollToTurn(targetTurnIndex);

			// Wait for scroll to complete, then position and show popup
			setTimeout(() => {
				const rect = turnElement.getBoundingClientRect();
				const viewportHeight = window.innerHeight;
				const viewportWidth = window.innerWidth;

				// Calculate center position over the turn
				let x = rect.left + rect.width / 2;
				let y = rect.top + rect.height / 2;

				// Ensure popup stays within viewport bounds
				const popupWidth = 300; // max-width from CSS
				const popupHeight = 120; // estimated height with larger font

				// Adjust x position to keep popup on screen
				if (x - popupWidth / 2 < 10) {
					x = popupWidth / 2 + 10;
				} else if (x + popupWidth / 2 > viewportWidth - 10) {
					x = viewportWidth - popupWidth / 2 - 10;
				}

				// Adjust y position to keep popup on screen
				if (y - popupHeight / 2 < 10) {
					y = popupHeight / 2 + 10;
				} else if (y + popupHeight / 2 > viewportHeight - 10) {
					y = viewportHeight - popupHeight / 2 - 10;
				}

				// Position popup centered over the turn bubble
				popupPosition = {
					x,
					y,
					visible: true
				};
			}, 600); // Wait longer for scroll animation to fully complete
		} else {
			// If no specific turn to anchor to, show popup at center
			popupPosition = {
				x: window.innerWidth / 2,
				y: window.innerHeight / 2,
				visible: true
			};
		}
	}

	function renderMarkdown(markdown: string): string {
		// Simple markdown renderer for basic formatting
		return markdown
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`(.*?)`/g, '<code>$1</code>');
	}

	function isCurrentPresentationTurn(turnIndex: number): boolean {
		if (!presentationActive || !presentation) return false;

		const currentStep = presentation[currentPresentationStep];
		if (!currentStep) return false;

		let targetTurnIndex = currentStep.idx;
		if (targetTurnIndex === -1) {
			targetTurnIndex = game.turns.length - 1;
		}

		return turnIndex === targetTurnIndex && popupPosition.visible;
	}

	onMount(() => {
		if (presentation && presentation.length > 0) {
			// Auto-start presentation after a brief delay
			setTimeout(startPresentation, 500);
		}
	});
</script>

<div class={className}>
	<div
		class="flex flex-col gap-4 {presentationActive ? 'presentation-mode' : ''}"
		bind:this={presentationContainer}
	>
		{#if presentationActive && presentation && popupPosition.visible}
			{#key currentPresentationStep}
				<div
					class="presentation-popup"
					style="left: {popupPosition.x}px; top: {popupPosition.y}px;"
					in:fly={{ y: -20, duration: 400, easing: backOut }}
					out:fly={{ y: -10, duration: 200, easing: quintOut }}
				>
					<div
						class="presentation-step"
						in:scale={{ duration: 300, delay: 100, easing: backOut, start: 0.8 }}
						out:scale={{ duration: 150, easing: quintOut, start: 0.8 }}
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html renderMarkdown(presentation[currentPresentationStep].markdown)}
					</div>
				</div>
			{/key}
		{/if}

		{#each game.turns as turn}
			<div
				class="turn flex flex-row items-end justify-center {turn.flagged
					? 'flagged-turn'
					: ''} {turn.rejected ? 'rejected-turn' : ''} {isCurrentPresentationTurn(turn.orderIndex)
					? 'presentation-active-turn'
					: ''}"
				data-testid={`turn-${turn.orderIndex}`}
			>
				{#if turn.isDrawing}
					<Speechbubble
						direction="right"
						clickable={true}
						onclick={() => openLightbox(turn.orderIndex)}
						onkeydown={(e) => e.key === 'Enter' && openLightbox(turn.orderIndex)}
						className="turn-drawing"
					>
						{#snippet children()}
							<img src={turn.content} alt="Drawing" class="h-auto w-full" />
						{/snippet}
					</Speechbubble>
				{/if}
				<div class="flex flex-col items-center">
					<div class="text-center text-xs">
						{#if showDates}
							<DateComponent date={turn.createdAt} />{/if}
						<div class="text-center text-xs">{turn.player?.username}</div>
					</div>

					<Avatar
						src={turn.player!.imageUrl}
						data-name={turn.player!.username}
						href="/p/{turn.player!.id}"
						size="lg"
					/>

					{#if isAdmin && turn.flagged && !turn.rejected}
						<div class="flex flex-col gap-2">
							{#each turn.flags.filter((flag: { resolvedAt: Date | null }) => !flag.resolvedAt) as flag}
								<div class="flex flex-row gap-2">
									<form method="POST" action="?/confirmFlag" use:enhance>
										<input type="hidden" name="flagId" value={flag.id} />
										<button type="submit" class="btn btn-primary">Confirm Flag</button>
									</form>
									<form method="POST" action="?/rejectFlag" use:enhance>
										<input type="hidden" name="flagId" value={flag.id} />
										<button type="submit" class="btn btn-primary">Reject Flag</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}

					{#if showFlagButtons && flagTurnForm}
						<div class="flex justify-center">
							<FlagTurnModal turnId={turn.id} formData={flagTurnForm} />
						</div>
					{/if}
				</div>
				{#if !turn.isDrawing}
					<Speechbubble
						direction="left"
						clickable={true}
						onclick={() => openLightbox(turn.orderIndex)}
						onkeydown={(e) => e.key === 'Enter' && openLightbox(turn.orderIndex)}
						className="turn-text"
					>
						{#snippet children()}
							<p>{turn.content}</p>
						{/snippet}
					</Speechbubble>
				{/if}
			</div>
		{/each}
		{#if showCompletedDate}
			<div class="flex flex-row items-center justify-between">
				<div class="flex items-stretch gap-2">
					<SignedIn>
						<FavoriteButton
							type="game"
							id={game.id}
							{isFavorited}
							{favoriteCount}
							customAction="?/toggleGameFavorite"
						/>
					</SignedIn>
					{#if game.completedAt && game.turns && game.turns.length > 0}
						<ShareButton title={`${PUBLIC_SITE_TITLE}: ${game.turns[0].content}`} />
					{/if}
				</div>
				<div class="turn-ellipsis">
					{#if !game.completedAt}
						...
					{:else}
						Game completed <DateComponent date={game.completedAt} />
						{#if game.isLewd}
							<span title="18+">🔞</span>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Lightbox for viewing turns -->
	<TurnLightbox
		{game}
		currentTurnIndex={currentLightboxIndex}
		isOpen={lightboxOpen}
		onClose={closeLightbox}
		onNavigate={navigateToTurn}
	/>

	{#if game.completedAt && showComments}
		<Comments comments={commentsFromProps} />
	{/if}

	<Debug value={game} />
	{#if game.id && commentsFromProps}
		<Debug value={commentsFromProps} />
	{/if}
</div>

<style lang="postcss">
	.turn-text {
		@apply flex w-max flex-col items-center justify-center self-stretch p-2 text-xl md:text-3xl;
	}

	.flagged-turn {
		@apply border-l-4 border-warning-500 pl-2;
	}

	.rejected-turn {
		@apply border-l-4 border-danger-500 pl-2;
		img {
			opacity: 0.1;
		}
	}

	.presentation-popup {
		@apply fixed z-50 -translate-x-1/2 -translate-y-1/2 transform;
		@apply rounded-xl bg-primary-900 bg-opacity-90 px-6 py-4 text-white;
		@apply border-2 border-primary-400 border-opacity-50 shadow-2xl backdrop-blur-md;
		max-width: 300px;
		pointer-events: none;

		/* Subtle glow effect */
		box-shadow:
			0 0 0 1px rgba(59, 130, 246, 0.3),
			0 10px 25px -5px rgba(0, 0, 0, 0.3),
			0 0 30px rgba(59, 130, 246, 0.2);
	}

	.presentation-active-turn {
		@apply transition-all duration-500 ease-out;
		@apply rounded-lg ring-2 ring-primary-400 ring-opacity-60;
		@apply bg-primary-50 bg-opacity-30;
		animation: gentle-pulse 2s ease-in-out infinite;
	}

	@keyframes gentle-pulse {
		0%,
		100% {
			@apply ring-opacity-60;
			transform: scale(1);
		}
		50% {
			@apply ring-opacity-80;
			transform: scale(1.02);
		}
	}

	.presentation-mode {
		@apply transition-all duration-700 ease-out;

		.turn {
			@apply transition-all duration-500 ease-out;
			@apply opacity-70;
		}

		.presentation-active-turn {
			@apply opacity-100;
		}
	}

	.presentation-step {
		@apply text-center text-2xl font-medium leading-tight;
		@apply transition-all duration-200 ease-out;

		:global(strong) {
			@apply font-bold text-warning-300 transition-colors duration-200;
		}

		:global(em) {
			@apply italic text-primary-300 transition-colors duration-200;
		}

		:global(code) {
			@apply rounded bg-primary-700 px-1 py-0.5 font-mono text-xs;
			@apply transition-all duration-200;
		}
	}
</style>
