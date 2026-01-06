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

	const enhancer: SubmitFunction = () => {
		isSubmitting = true;
		return async ({ update }) => {
			await update();
			isSubmitting = false;
		};
	};
</script>

{#if favoriteCount !== null}
	<form method="POST" action={customAction} use:enhance={enhancer}>
		<input type="hidden" name="id" value={id} />

		<input type="hidden" name="action" value={isFavorited ? 'unfavorite' : 'favorite'} />
		<Button
			type="submit"
			color={isFavorited ? 'primary' : 'alternative'}
			disabled={isSubmitting || !id}
			class="flex items-center gap-1"
			aria-label={isFavorited ? `Unfavorite ${type}` : `Favorite ${type}`}
		>
			{#if isSubmitting}
				<Spinner class="me-3" size="4" />
			{:else}
				<iconify-icon
					icon={isFavorited
						? 'material-symbols:favorite'
						: 'material-symbols:favorite-outline'}
					class="h-4 w-4"
				></iconify-icon>
				{#if favoriteCount > 0}
					<span class="text-sm">{favoriteCount}</span>
				{/if}
			{/if}
		</Button>
	</form>
{/if}
