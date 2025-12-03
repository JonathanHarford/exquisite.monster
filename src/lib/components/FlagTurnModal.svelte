<script lang="ts">
	import { z } from 'zod/v4';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { superForm } from 'sveltekit-superforms/client';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Modal, Select, Textarea, Label } from 'flowbite-svelte';
	import SuccessBox from '$lib/components/SuccessBox.svelte';
	import ErrorBox from '$lib/components/ErrorBox.svelte';
	import { flagTurnSchema } from '$lib/formSchemata';
	import { invalidateAll } from '$app/navigation';
	import { applyAction } from '$app/forms';

	const {
		turnId,
		formData
	}: {
		turnId: string;
		formData: SuperValidated<z.infer<typeof flagTurnSchema>>;
	} = $props();

	let open = $state(false);

	// Initialize form
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, message } = superForm(formData, {
		validators: zod4(flagTurnSchema),
		onSubmit: async () => {
			// Invalidate layout data before form submission
			await invalidateAll();
		},
		onResult: async ({ result }) => {
			// Handle successful flag submission
			if (result.type === 'success' || result.type === 'redirect') {
				open = false; // Close the modal on success
				// Apply the action to handle redirects properly
				await applyAction(result);
			}
		}
	});
</script>

<!-- Flag Button -->
<button type="button" onclick={() => (open = true)} aria-label="Report turn" class="flag-button">
	<iconify-icon icon="material-symbols:flag"></iconify-icon>
</button>

<!-- Flag Turn Modal -->
<Modal title="Report Turn" bind:open size="md" outsideclose>
	<form method="POST" action="?/flag" use:enhance class="space-y-4">
		<input type="hidden" name="turnId" value={turnId} />

		<div>
			<Label for="reason">Reason for reporting</Label>
			<Select id="reason" name="reason" required bind:value={$form.reason}>
				<option value="spam">Spam</option>
				<option value="offensive">Offensive content</option>
				<option value="other">Other</option>
			</Select>
			{#if $errors.reason}<span class="error">{$errors.reason}</span>{/if}
		</div>

		<div>
			<Label for="explanation">Additional details (optional)</Label>
			<Textarea id="explanation" name="explanation" rows={4} bind:value={$form.explanation} />
			{#if $errors.explanation}<span class="error">{$errors.explanation}</span>{/if}
		</div>

		{#if Object.keys($errors).length > 0}
			<ErrorBox>
				<p>Please fix the errors above and try again.</p>
			</ErrorBox>
		{/if}

		{#if $message}
			<SuccessBox>{$message}</SuccessBox>
		{/if}

		<div class="flex justify-end space-x-2">
			<button type="button" class="btn btn-cancel" onclick={() => (open = false)}>Cancel</button>
			<button type="submit" class="btn btn-primary">Submit Report</button>
		</div>
	</form>
</Modal>

<style lang="postcss">
	span.error {
		@apply text-danger-500;
	}
</style>
