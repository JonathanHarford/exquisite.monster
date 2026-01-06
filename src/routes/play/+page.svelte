<script lang="ts">
	import { enhance } from '$app/forms';
	import { appState } from '$lib/appstate.svelte';
	import { resolve } from '$app/paths';
	import SEO from '$lib/components/SEO.svelte';
	import { PUBLIC_SITE_TITLE } from '$env/static/public';
	import { isHLCPlayer } from '$lib/utils/hlc';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let findingGamePromise: Promise<void> | null = $state(null);
	// Ensure consistent HLC determination - must be true for minors and players without self data
	let isHLC = $derived(!data.self ? true : isHLCPlayer(data.self));

	// Determine if there's at least one game available (any type)
	const hasAnyGame = $derived(
		data.availableGameTypes.writingSafe ||
			data.availableGameTypes.writingLewd ||
			data.availableGameTypes.drawingSafe ||
			data.availableGameTypes.drawingLewd
	);

	// For HLC users, check if there's any safe game available
	const hasAnySafeGame = $derived(
		data.availableGameTypes.writingSafe || data.availableGameTypes.drawingSafe
	);

	// Enhance callback to track submission promise
	import type { SubmitFunction } from '@sveltejs/kit';

	const enhanceCb: SubmitFunction = () => {
		let resolver: () => void;
		// Create a promise that will resolve when the update is complete
		findingGamePromise = new Promise<void>((resolve) => {
			resolver = resolve;
		});

		appState.ui.loading = true;

		return async ({ update }) => {
			await update();
			appState.ui.loading = false;
			resolver();
			findingGamePromise = null;
		};
	};

	// Helper function to get tooltip text for disabled buttons
	function getDisabledTooltip(options: {
		findingGamePromise: Promise<void> | null;
		isHLC?: boolean;
		noGamesAvailable?: boolean;
	}): string | null {
		if (options.findingGamePromise) return 'Please wait while we find a game...';
		if (options.isHLC) return 'You must be 18+ to play adult content';
		if (options.noGamesAvailable) return 'No games available of this type right now';
		return null;
	}
</script>

<SEO
	title="Play - {PUBLIC_SITE_TITLE}"
	description="Start playing {PUBLIC_SITE_TITLE} - join a game and play a turn!"
/>

<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4">
	<section>
		<h1>Ready to Play?</h1>

		<p class="text-center">You'll be matched with the game expiring soonest.</p>
	</section>

	<form method="POST" action="?/startTurn" use:enhance={enhanceCb}>
		<!-- For HLC users, isLewd will be false. For non-HLC, it will be undefined, matching any. -->
		<input type="hidden" name="isLewd" value={isHLC ? 'false' : ''} />
		{#await findingGamePromise}
			<button
				type="submit"
				class="btn btn-cta px-8 py-4 text-xl"
				disabled
			>
				Finding a game...
			</button>
		{:then}
			<button
				type="submit"
				class="btn btn-cta px-8 py-4 text-xl"
				disabled={appState.ui.loading}
			>
				Play
			</button>
		{/await}
	</form>

	<details class="w-full max-w-lg text-center">
		<summary class="cursor-pointer text-lg">Let me choose!</summary>
		<div class="border-base-content/20 mt-4 rounded-lg border p-4">
			<div class="grid grid-cols-[1fr_auto_auto] items-center gap-4 text-left">
				<!-- Row 1 -->

				<div>Receive a picture, submit <b>writing</b></div>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="turnType" value="writing" />
					<input type="hidden" name="isLewd" value="false" />
					<button
						type="submit"
						class="btn btn-cta h-full w-full"
						disabled={!!findingGamePromise || !data.availableGameTypes.writingSafe}
						title={getDisabledTooltip({
							findingGamePromise,
							noGamesAvailable: !data.availableGameTypes.writingSafe
						}) ?? ''}
					>
						Play
					</button>
				</form>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="turnType" value="writing" />
					<input type="hidden" name="isLewd" value="true" />
					<button
						type="submit"
						class="btn btn-danger h-full w-full"
						disabled={!!findingGamePromise || isHLC || !data.availableGameTypes.writingLewd}
						title={getDisabledTooltip({
							findingGamePromise,
							isHLC,
							noGamesAvailable: !data.availableGameTypes.writingLewd
						}) ?? ''}
					>
						Play 18+
					</button>
				</form>

				<div>Receive writing, submit <b>picture</b></div>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="turnType" value="drawing" />
					<input type="hidden" name="isLewd" value="false" />
					<button
						type="submit"
						class="btn btn-cta h-full w-full"
						disabled={!!findingGamePromise || !data.availableGameTypes.drawingSafe}
						title={getDisabledTooltip({
							findingGamePromise,
							noGamesAvailable: !data.availableGameTypes.drawingSafe
						}) ?? ''}
					>
						Play
					</button>
				</form>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="turnType" value="drawing" />
					<input type="hidden" name="isLewd" value="true" />
					<button
						type="submit"
						class="btn btn-danger h-full w-full"
						disabled={!!findingGamePromise || isHLC || !data.availableGameTypes.drawingLewd}
						title={getDisabledTooltip({
							findingGamePromise,
							isHLC,
							noGamesAvailable: !data.availableGameTypes.drawingLewd
						}) ?? ''}
					>
						Play 18+
					</button>
				</form>

				<div class="font-bold">Start a new game</div>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="turnType" value="first" />
					<input type="hidden" name="isLewd" value="false" />
					<button
						type="submit"
						class="btn btn-cta h-full w-full"
						disabled={!!findingGamePromise}
						title={getDisabledTooltip({ findingGamePromise }) ?? ''}
					>
						Play
					</button>
				</form>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="turnType" value="first" />
					<input type="hidden" name="isLewd" value="true" />
					<button
						type="submit"
						class="btn btn-danger h-full w-full"
						disabled={!!findingGamePromise || isHLC}
						title={getDisabledTooltip({ findingGamePromise, isHLC }) ?? ''}
					>
						Play 18+
					</button>
				</form>

				<div class="italic">I'm Feeling Lucky</div>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="isLewd" value={isHLC ? 'false' : ''} />
					<button
						type="submit"
						class="btn btn-cta h-full w-full"
						disabled={!!findingGamePromise}
						title={getDisabledTooltip({ findingGamePromise }) ?? ''}
					>
						Play
					</button>
				</form>
				<form method="POST" action="?/startTurn" use:enhance={enhanceCb} class="display-contents">
					<input type="hidden" name="isLewd" value="true" />
					<button
						type="submit"
						class="btn btn-danger h-full w-full"
						disabled={!!findingGamePromise || isHLC}
						title={getDisabledTooltip({ findingGamePromise, isHLC }) ?? ''}
					>
						Play 18+
					</button>
				</form>
			</div>
			{#if !isHLC}
				<p class="mt-4 text-center text-sm">
					18+ doesn't mean you <i>have</i> to get freaky, just that you're free to if you're the kind
					of sicko that finds that kind of stuff funny.
				</p>
			{/if}
		</div>
	</details>

	<p>
		Or, instead of playing against internet randos, try <a href={resolve('/s/new')}>Party Mode (Beta)</a> with your
		real friends! It is undeniably the best way to play.
	</p>
</div>
