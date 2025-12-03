<script lang="ts">
	import { superForm } from 'sveltekit-superforms/client';
	import { appState } from '$lib/appstate.svelte';
	import { gameConfigSchema } from '$lib/formSchemata';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { z } from 'zod/v4';
	import { Input, Label, Button, Alert } from 'flowbite-svelte';
	import ErrorBox from '$lib/components/ErrorBox.svelte';
	import { zod4 } from 'sveltekit-superforms/adapters';

	const { formData }: { formData: SuperValidated<z.infer<typeof gameConfigSchema>> } = $props();

	// svelte-ignore state_referenced_locally
	const { form, enhance, errors, message, constraints, tainted, isTainted } = superForm(formData, {
		dataType: 'json',
		validators: zod4(gameConfigSchema),
		resetForm: false,
		syncFlashMessage: false,
		onSubmit: () => {
			appState.ui.loading = true;
		},
		onUpdated: () => {
			appState.ui.loading = false;
		}
	});
</script>

<form use:enhance method="POST" action="?/updateSiteConfig" class="space-y-6">
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Min/Max Turns Row -->
		<div class="space-y-2">
			<Label for="minTurns">Min Turns</Label>
			<Input
				id="minTurns"
				name="minTurns"
				type="number"
				bind:value={$form.minTurns}
				{...$constraints.minTurns}
				placeholder="Minimum turns required"
			/>
			{#if $errors.minTurns}
				<ErrorBox>
					<p>{$errors.minTurns}</p>
				</ErrorBox>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="maxTurns">Max Turns</Label>
			<Input
				id="maxTurns"
				name="maxTurns"
				type="number"
				bind:value={$form.maxTurns}
				{...$constraints.maxTurns}
				placeholder="0 for unlimited"
			/>
			{#if $errors.maxTurns}
				<ErrorBox>
					<p>{$errors.maxTurns}</p>
				</ErrorBox>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
		<!-- Timeout Fields Row -->
		<div class="space-y-2">
			<Label for="writingTimeout">Writing Timeout</Label>
			<Input
				id="writingTimeout"
				name="writingTimeout"
				type="text"
				bind:value={$form.writingTimeout}
				{...$constraints.writingTimeout}
				placeholder="e.g. 10m, 1h, 2h30m"
			/>
			{#if $errors.writingTimeout}
				<ErrorBox>
					<p>{$errors.writingTimeout}</p>
				</ErrorBox>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="drawingTimeout">Drawing Timeout</Label>
			<Input
				id="drawingTimeout"
				name="drawingTimeout"
				type="text"
				bind:value={$form.drawingTimeout}
				{...$constraints.drawingTimeout}
				placeholder="e.g. 24h, 1d, 2d12h"
			/>
			{#if $errors.drawingTimeout}
				<ErrorBox>
					<p>{$errors.drawingTimeout}</p>
				</ErrorBox>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="gameTimeout">Game Timeout</Label>
			<Input
				id="gameTimeout"
				name="gameTimeout"
				type="text"
				bind:value={$form.gameTimeout}
				{...$constraints.gameTimeout}
				placeholder="e.g. 7d, 1d12h, 168h"
			/>
			{#if $errors.gameTimeout}
				<ErrorBox>
					<p>{$errors.gameTimeout}</p>
				</ErrorBox>
			{/if}
		</div>
	</div>

	<div class="flex justify-center pt-4">
		{#if $message && !isTainted($tainted)}
			<Alert color="green" class="flex items-center gap-2">
				<iconify-icon icon="material-symbols:check-circle" class="h-5 w-5"></iconify-icon>
				{$message}
			</Alert>
		{:else}
			<Button
				type="submit"
				disabled={!isTainted($tainted)}
				color="blue"
				class="flex items-center gap-2"
			>
				<iconify-icon icon="material-symbols:save" class="h-4 w-4"></iconify-icon>
				Save Configuration
			</Button>
		{/if}
	</div>
</form>
