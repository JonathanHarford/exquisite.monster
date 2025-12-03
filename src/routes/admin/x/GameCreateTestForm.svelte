<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button } from 'flowbite-svelte';

	let {
		disabled = false,
		onResult
	}: {
		disabled?: boolean;
		onResult?: (
			result: ActionResult,
			turnCount: 1 | 2
		) => void;
	} = $props();

	let creating1Turn = $state(false);
	let creating2Turns = $state(false);

	const handleSubmit = (turnCount: 1 | 2) => {
		return () => {
			if (turnCount === 1) {
				creating1Turn = true;
			} else {
				creating2Turns = true;
			}

			return async ({ result }: { result: ActionResult }) => {
				creating1Turn = false;
				creating2Turns = false;
				onResult?.(result, turnCount);
			};
		};
	};
</script>

<div class="rounded-lg border border-solid border-black">
	<h3>Test Game Creation</h3>
	<p>Create test games for development and testing purposes.</p>

	<div class="flex gap-3">
		<form method="POST" action="?/createTestGame1Turn" use:enhance={handleSubmit(1)}>
			<Button
				type="submit"
				disabled={disabled || creating1Turn || creating2Turns}
				color="blue"
				class="flex items-center gap-2"
			>
				{#if creating1Turn}
					<iconify-icon icon="material-symbols:hourglass-empty" class="h-4 w-4 animate-spin"
					></iconify-icon>
					Creating...
				{:else}
					<iconify-icon icon="material-symbols:edit" class="h-4 w-4"></iconify-icon>
					1 Turn
				{/if}
			</Button>
		</form>

		<form method="POST" action="?/createTestGame2Turns" use:enhance={handleSubmit(2)}>
			<Button
				type="submit"
				disabled={disabled || creating1Turn || creating2Turns}
				color="green"
				class="flex items-center gap-2"
			>
				{#if creating2Turns}
					<iconify-icon icon="material-symbols:hourglass-empty" class="h-4 w-4 animate-spin"
					></iconify-icon>
					Creating...
				{:else}
					<iconify-icon icon="material-symbols:image" class="h-4 w-4"></iconify-icon>
					2 Turns
				{/if}
			</Button>
		</form>
	</div>

	<div>
		<p>
			<strong>1 Turn:</strong> Creates an incomplete game with a single sentence turn ("The cat sat on
			the mat")
		</p>
		<p><strong>2 Turns:</strong> Same as above but also adds a picture turn (/img/x/tcsotm.jpg)</p>
	</div>
</div>
