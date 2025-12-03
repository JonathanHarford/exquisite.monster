<script lang="ts">
	import type { GameWithTurns } from '$lib/types/domain';

	interface Props {
		game: GameWithTurns;
	}

	let { game }: Props = $props();
</script>

<div class="card-bg game-card transition-shadow hover:shadow-lg">
	<a href="/g/{game.id}" class="game-link" aria-label="View game with {game.completedCount} turns">
		{#if game.turns.length > 0}
			{@const posterTurn = game.posterTurnId
				? game.turns.find((t) => t.id === game.posterTurnId)
				: game.turns.find((turn) => turn.isDrawing)}
			{@const firstWriting = game.turns.find((turn) => !turn.isDrawing)}

			<div class="game-preview">
				{#if posterTurn}
					<img
						src={posterTurn.content}
						alt="Game preview drawing"
						class="preview-image"
						loading="lazy"
					/>
					{#if firstWriting}
						<div class="preview-overlay">
							<p class="preview-text">{firstWriting.content}</p>
						</div>
					{/if}
				{:else if firstWriting}
					<div class="text-preview">
						<p>{firstWriting.content}</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="empty-preview">
				<iconify-icon icon="material-symbols:image-not-supported-outline"></iconify-icon>
				<p>No turns yet</p>
			</div>
		{/if}

		<div class="game-info">
			<div class="game-meta">
				<span class="turn-count">{game.completedCount} turns</span>
				<div class="favorites-display">
					<iconify-icon icon="mdi:heart" class="heart-icon"></iconify-icon>
					<span class="favorites-count">{game.favoritesCount}</span>
				</div>
				{#if game.completedAt}
					<span class="completed-badge">✓</span>
				{/if}
				{#if game.isLewd}
					<span class="lewd-badge" title="18+">🔞</span>
				{/if}
			</div>
		</div>
	</a>
</div>

<style lang="postcss">
	img {
		@apply bg-white; /* In case of PNG */
	}
	.game-card {
		@apply overflow-hidden;
	}

	.game-link {
		@apply block h-full rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
	}

	.game-preview {
		@apply relative aspect-square;
	}

	.preview-image {
		@apply h-full w-full object-cover;
	}

	.preview-overlay {
		@apply absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100;
	}

	.preview-text {
		@apply text-center font-bold;
		text-shadow: 2px 1px 2px yellow;
	}

	.text-preview {
		@apply flex h-full items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100;
	}

	.text-preview p {
		@apply text-center;
	}

	.empty-preview {
		@apply flex h-full flex-col items-center justify-center;
	}

	.game-meta {
		@apply flex items-center justify-between;
	}

	.favorites-display {
		@apply relative flex items-center justify-center;
	}

	.heart-icon {
		@apply text-danger-500;
		font-size: 1.5rem;
	}

	.favorites-count {
		@apply absolute text-xs font-bold text-white;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
	}

	.game-link {
		@apply text-black;
	}

	/* Mobile responsiveness */
	@media (max-width: 640px) {
		.preview-overlay {
			/* On mobile, show overlay on tap instead of hover */
			@apply opacity-100 md:opacity-0;
		}

		.game-link {
			/* Improve touch targets on mobile */
			@apply focus:ring-1 focus:ring-offset-1;
		}
	}

	/* Reduce motion for users who prefer it */
	@media (prefers-reduced-motion: reduce) {
		.preview-overlay,
		.game-card {
			@apply transition-none;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.game-card {
			@apply border border-primary-400;
		}
	}
</style>
