<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { Button, Spinner } from 'flowbite-svelte';

	// Props
	const {
		type = 'player', // Default to 'player' or make it required
		id,
		isFavorited,
		favoriteCount,
		customAction // Renamed 'action' prop to avoid conflict with form attribute
	}: {
		type: string;
		id: string;
		isFavorited: boolean;
		favoriteCount: number | null; // null to hide the button, cheesy I know
		customAction: string; // For custom endpoint actions
	} = $props();

	let isSubmitting = $state(false);

	// HACK: The count and isFavorited state are not updating on submission (unlike player favorites, which works fine!)
	// so we manually update these values
	// svelte-ignore state_referenced_locally
	let countState = $state(favoriteCount);
	// svelte-ignore state_referenced_locally
	let isFavoritedState = $state(isFavorited);

	$effect(() => {
		countState = favoriteCount;
		isFavoritedState = isFavorited;
	});

	const enhancer: SubmitFunction = (e) => {
		isSubmitting = true;
		let action = e.formData.get('action');
		return async ({ result, update }) => {
			isSubmitting = false;
			if (result.type === 'success' && countState !== null) {
				if (action === 'favorite') {
					countState = countState + 1;
					isFavoritedState = true;
				} else {
					countState = countState - 1;
					isFavoritedState = false;
				}
			}
			await update();
		};
	};
</script>

{#if favoriteCount !== null}
	<form method="POST" action={customAction} use:enhance={enhancer}>
		<input type="hidden" name="id" value={id} />

		<input type="hidden" name="action" value={isFavoritedState ? 'unfavorite' : 'favorite'} />
		<Button
			type="submit"
			color={isFavoritedState ? 'primary' : 'alternative'}
			disabled={isSubmitting || !id}
			class="flex items-center gap-1"
			aria-label={isFavoritedState ? `Unfavorite ${type}` : `Favorite ${type}`}
		>
			{#if isSubmitting}
				<Spinner class="me-3" size="4" />
			{:else}
				<iconify-icon
					icon={isFavoritedState
						? 'material-symbols:favorite'
						: 'material-symbols:favorite-outline'}
					class="h-4 w-4"
				></iconify-icon>
				{#if countState && countState > 0}
					<span class="text-sm">{countState}</span>
				{/if}
			{/if}
		</Button>
	</form>
{/if}
