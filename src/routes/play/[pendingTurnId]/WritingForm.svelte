<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { page } from '$app/state';
	import { appState } from '$lib/appstate.svelte';

	const enhanceWritingForm = () => {
		appState.ui.loading = true;
		return async ({ result }: { result: ActionResult }) => {
			appState.ui.loading = false;
			// If the server action for writing redirects on error,
			// this applyAction might not show an error on *this* page
			// as the page will navigate away. But if the action used fail(),
			// this would populate the form store for +page.svelte.
			await applyAction(result);
		};
	};

	const isLewdGame = $derived(page.data.pendingGame?.isLewd || false);
</script>

<form method="POST" action="?/submitWriting" class="form-writing" use:enhance={enhanceWritingForm}>
	<input type="hidden" name="type" value="writing" />
	<textarea name="content" rows="3" placeholder="Write your description here..."></textarea>

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
