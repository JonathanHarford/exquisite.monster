<script lang="ts">
	import { page } from '$app/state';
	import { appState } from '$lib/appstate.svelte';
	import { formatDuration } from '$lib/datetime';
	import { SignUpButton } from 'svelte-clerk';

	const { user, class: className = "" } = $props();

	const timer = $derived(appState.timer);
	const pendingTurn = $derived(appState.play.pendingTurn);
	const pendingPartyTurnCount = $derived(appState.play.pendingPartyTurnCount);

	const isOnPlayPage = $derived(pendingTurn && page.url.pathname === `/play/${pendingTurn.id}`);
	const shouldThrob = $derived(
		(timer && !isOnPlayPage) || (pendingPartyTurnCount && !isOnPlayPage)
	);
</script>

{#if user}
	{#if timer && pendingTurn}
		<a
			href={`/play/${pendingTurn.id}`}
			class="timer btn btn-cta flex h-full {className || 'w-full'} items-center justify-center gap-2 {appState.ui.timerSoon || shouldThrob ? 'throb' : ''}"
		>
			<iconify-icon icon="mdi:clock" height={24} class="text-white"></iconify-icon>
			<span class="text-lg">{formatDuration(timer.ms)}</span>
		</a>
	{:else if pendingPartyTurnCount && pendingPartyTurnCount > 0}
		<a
			href="/play"
			class="btn btn-cta flex h-full {className || 'w-full'} items-center justify-center {shouldThrob ? 'throb' : ''}"
		>
			Play your {pendingPartyTurnCount} waiting turn{pendingPartyTurnCount === 1 ? '' : 's'}!
		</a>
	{:else}
		<a href="/play" class="btn btn-cta flex h-full {className || 'w-full'} items-center justify-center"> Play </a>
	{/if}
{:else}
	<SignUpButton mode="modal" class="flex h-full {className || 'w-full'}">
		<div class="btn btn-cta flex h-full {className || 'w-full'} items-center justify-center">Play</div>
	</SignUpButton>
{/if}

<style lang="postcss">
	.timer {
		@apply px-2 font-mono text-lg;
	}

	.throb {
		animation: throb 1s ease-in-out infinite;
	}

	@keyframes throb {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.8;
		}
	}
</style>
