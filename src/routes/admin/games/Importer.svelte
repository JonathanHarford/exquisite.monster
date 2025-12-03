<script lang="ts">
	import { Button, Fileupload, Label } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';

	let loading = false;
	$: form = $page.form as ActionData;

	const handleSubmit = () => {
		loading = true;
		return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
			await update();
			loading = false;
		};
	};
</script>

<div class="importer">
	<h3>Import Games from ZIP</h3>
	<form
		method="POST"
		action="?/importGames"
		use:enhance={handleSubmit}
		enctype="multipart/form-data"
	>
		<div class="mb-6">
			<Label for="zipfile" class="mb-2">ZIP file</Label>
			<Fileupload id="zipfile" name="zipfile" required />
		</div>
		<Button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</Button>
	</form>

	{#if form?.success}
		<div
			class="mb-4 rounded-lg bg-green-100 p-4 text-sm text-green-700 dark:bg-green-200 dark:text-green-800"
			role="alert"
		>
			{form.message}
		</div>
	{/if}

	{#if form?.error}
		<div
			class="mb-4 rounded-lg bg-red-100 p-4 text-sm text-red-700 dark:bg-red-200 dark:text-red-800"
			role="alert"
		>
			{form.message}
		</div>
	{/if}
</div>
