<script lang="ts">
	import { page } from '$app/state';
	import { appState } from '$lib/appstate.svelte';
	import { submitWriting } from './submit.remote';

	const isLewdGame = $derived(page.data.pendingGame?.isLewd || false);
	let error = $state<string | null>(null);
</script>

<form
	{...submitWriting.enhance(async (opts) => {
		appState.ui.loading = true;
		error = null;
		try {
			await opts.submit();
			// Check for action failure in the result
			const result = submitWriting.result as any;
			if (result?.type === 'failure') {
				error = result?.data?.error || 'Submission failed';
			}
		} catch (e) {
			console.error(e);
			error = 'An unexpected error occurred';
		} finally {
			appState.ui.loading = false;
		}
	})}
	class="form-writing"
>
	<input type="hidden" name="type" value="writing" />
	<textarea name="content" rows="3" placeholder="Write your description here..."></textarea>

	{#if error}
		<div class="text-red-500 text-sm text-center">{error}</div>
	{/if}

	<button type="submit" class="btn btn-primary mx-auto" disabled={appState.ui.loading}>
		{appState.ui.loading ? 'Submitting...' : 'Submit Turn'}
	</button>
</form>
<section>
	<h3>Some Guidelines</h3>
	<ol class="list">
		<li>
			{#if isLewdGame}
				<span class="text-red-500"
					>This is Exquisite Monster After Dark! Be as lewd as you want!</span
				>
			{:else}
				Keep it family friendly!
			{/if}
		</li>
		{#if !page.data.previousTurn}<li>
				Don't be proverb guy. "One man's meat is another man's poison" might be your meat but it is
				also <i>game-never-goes-off-the-rails poison.</i>
			</li>{/if}
		<li><i>Interpretive beats literal.</i> <i>Include something undrawable!</i></li>
		<li>Don't be afraid to go first- (or second-) person!</li>
		<li>
			<i>Derive the narrative!</i> What's the story behind the tableau? Give people names and intentions!
		</li>
	</ol>
</section>

<style lang="postcss">
	.form-writing {
		@apply flex flex-col gap-4;
		textarea {
			@apply w-full rounded-lg; /* p-2 removed */
		}
	}
</style>
