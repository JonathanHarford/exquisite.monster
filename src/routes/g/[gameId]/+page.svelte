<script lang="ts">
	import GameView from '$lib/components/GameView.svelte';
	import type { PageProps } from './$types';
	import { resolve } from '$app/paths';
	import SEO from '$lib/components/SEO.svelte';
	import GameAdminControls from './GameAdminControls.svelte';

	const { data }: PageProps = $props();
	const { game, comments, isFavoritedByCurrentUser, gameFavCount } = $derived(data);

	// Create a description from the first turn if available
	const firstTurn = $derived(game.turns?.[0]);
	const gameDescription = $derived(
		firstTurn && !firstTurn.isDrawing
			? `"${firstTurn.content.slice(0, 100)}${firstTurn.content.length > 100 ? '...' : ''}"`
			: 'Game Details'
	);

	const completedTurns = $derived(game.turns?.filter((turn) => turn.completedAt).length);
	const minTurns = $derived(game.config?.minTurns);
	const turnsNeeded = $derived(Math.max(0, minTurns - completedTurns));
	const gameTimeout = $derived(game.config?.gameTimeout);

	const gameCompletionMessage = $derived(
		game.completedAt
			? null
			: turnsNeeded > 0
				? `You'll be notified once this game is done (which will happen once ${turnsNeeded} more turn${turnsNeeded === 1 ? '' : 's'} ${turnsNeeded === 1 ? 'has' : 'have'} been completed and ${gameTimeout} has passed without a turn).`
				: `You'll be notified once this game is done (which will happen once ${gameTimeout} has passed without a turn).`
	);
</script>

<SEO
	title={gameDescription}
	description={gameDescription}
	type="article"
	image={game.turns?.find((t) => t.isDrawing)?.content}
/>

{#if gameCompletionMessage}
	<div class="card mb-4">
		<p>{gameCompletionMessage}</p>
		<p>Until then, how about <a href={resolve('/play')}>playing a turn in another game?</a></p>
	</div>
{/if}

<GameView {game} {comments} isFavorited={isFavoritedByCurrentUser} favoriteCount={gameFavCount} />

{#if data.self?.isAdmin}
	<GameAdminControls {data} />
{/if}
