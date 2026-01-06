<script lang="ts">
	import { goto } from '$app/navigation';
	import Debug from '$lib/components/Debug.svelte';
	import ErrorBox from '$lib/components/ErrorBox.svelte';
	import type { PageProps } from './$types';
	import WritingForm from './WritingForm.svelte';
	import DrawingForm from './DrawingForm.svelte';
	import FlagTurnModal from '$lib/components/FlagTurnModal.svelte';
	import SEO from '$lib/components/SEO.svelte';

	const { data, form }: PageProps = $props();
	let { pendingGame, previousTurn, pendingTurn, party } = $derived(data);
	$effect(() => {
		// I don't think this should ever happen, but just in case
		if (!pendingGame) {
			console.log('no pending game');
			goto('/', { invalidate: ['self'] });
		}
	});
	const headingPrompt = $derived(() => {
		const basePrompt = !previousTurn
			? 'Start a new game with a sentence!'
			: previousTurn.isDrawing
				? 'What do you see in this picture?'
				: 'Upload a picture of this sentence!';

		return pendingGame?.isLewd ? `🔞 ${basePrompt} 🔞` : basePrompt;
	});
</script>

<SEO title="Play Game" description="Your turn! {headingPrompt}" noIndex={true} />

{#if party}
	<h2>{party.title}</h2>
{/if}
<h2>{headingPrompt()}</h2>

<div class="flex flex-col gap-4">
	{#if data.previousTurn}
		<section class="relative flex items-center justify-center">
			<div class="previous-turn-content flex flex-col items-center">
				{#if data.previousTurn.isDrawing}
					<img class="drawing" src={data.previousTurn.content} alt="Previous drawing" />
				{:else}
					<p class="writing">{data.previousTurn.content}</p>
				{/if}
			</div>
			<div class="absolute bottom-4 right-4">
				<FlagTurnModal turnId={data.previousTurn.id} formData={data.flagTurnForm} />
			</div>
		</section>
	{/if}

	{#if !previousTurn || previousTurn.isDrawing}
		<div class="hidden" data-testid="timeout">{pendingGame?.config.writingTimeout}</div>
		<WritingForm />
	{:else}
		<div class="hidden" data-testid="timeout">{pendingGame?.config.drawingTimeout}</div>
		<DrawingForm />
	{/if}

	<Debug value={previousTurn} />
	<Debug value={pendingTurn} />
</div>

<style lang="postcss">
	.previous-turn-content {
		@apply rounded-lg;
	}

	.writing {
		font-family: 'script', sans-serif;
		@apply text-center text-2xl;
	}
</style>
