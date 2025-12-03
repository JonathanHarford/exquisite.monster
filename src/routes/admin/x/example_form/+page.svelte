<script lang="ts">
	import { appState } from '$lib/appstate.svelte';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { superForm } from 'sveltekit-superforms';
	import { applyAction } from '$app/forms';
	import type { SuperValidated, Infer } from 'sveltekit-superforms';
	import { z } from 'zod/v4';
	import { Input, Label } from 'flowbite-svelte';
	import ErrorBox from '$lib/components/ErrorBox.svelte';

	// Same as in the server. In practice, this would be in $lib/formSchemas.ts
	const schema = z.object({
		email: z.email(),
		password: z.string().min(6)
	});

	const {
		data
	}: {
		data: {
			formSample: SuperValidated<Infer<typeof schema>>;
			otherImportantData: string;
		};
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, enhance, errors, message } = superForm(data.formSample, {
		validators: zod4(schema),
		dataType: 'json',
		onSubmit: () => {
			appState.ui.loading = true;
		},
		onResult: ({ result }) => {
			appState.ui.loading = false;
			if (result.type === 'success') {
				applyAction(result);
			}
		}
	});
</script>

<svelte:head>
	<title>Example Form - Admin Dashboard</title>
</svelte:head>

<form method="POST" use:enhance class="flex flex-col gap-4">
	<div>
		<Label for="email">Email</Label>
		<Input
			name="email"
			type="email"
			aria-invalid={$errors.email ? 'true' : undefined}
			id="email"
			placeholder="Email"
			autocomplete="email"
			required
			bind:value={$form.email}
		/>
	</div>
	<div>
		<Label for="password">Password</Label>
		<Input
			name="password"
			type="password"
			aria-invalid={$errors.password ? 'true' : undefined}
			id="password"
			placeholder="Password"
			bind:value={$form.password}
		/>
	</div>
	<button type="submit" class="btn btn-primary">Submit</button>
	{#if $message}<p class="success">{$message}</p>{/if}
	{#if $errors}
		<ErrorBox>
			<p>{$errors.email}</p>
			<p>{$errors.password}</p>
		</ErrorBox>
	{/if}
	{data.otherImportantData}
</form>
