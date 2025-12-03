<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { contactFormSchema } from '$lib/formSchemata';
	import { Input, Label, Textarea, Button, Alert } from 'flowbite-svelte';
	import ErrorBox from '$lib/components/ErrorBox.svelte';
	import type { PageData } from './$types';
	import { PUBLIC_SITE_TITLE } from '$env/static/public';
	import { env } from '$env/dynamic/public';
	import SEO from '$lib/components/SEO.svelte';

	const PUBLIC_DISCORD_INVITE_ID = env.PUBLIC_DISCORD_INVITE_ID;
	const PUBLIC_LIBERAPAY_ID = env.PUBLIC_LIBERAPAY_ID;

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	const { form, enhance, errors, message, submitting } = superForm(data.form, {
		validators: zod4(contactFormSchema),
		resetForm: true,
		onUpdate({ form }) {
			if (form.valid) {
				// Form will be reset automatically due to resetForm: true
				return;
			}
		}
	});
</script>

<SEO
	title="Contact Us"
	description="Join our Discord and/or send us your questions, feedback, or suggestions about {PUBLIC_SITE_TITLE}."
/>
<h2>Contact Us</h2>
<div class="flex flex-col items-start gap-4 md:flex-row">
	<div class="card-bg">
		<div class="contact-header">
			<h3>Email</h3>
			<p>Have a question, suggestion, or need help? We'd love to hear from you!</p>
		</div>

		{#if $message}
			<Alert color="green" class="flex items-center gap-2">
				<iconify-icon icon="material-symbols:check-circle" class="h-5 w-5"></iconify-icon>
				{$message}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="contact-form">
			<div class="form-row">
				<div class="form-group">
					<Label for="name" class="mb-2 block">Name *</Label>
					<Input
						id="name"
						name="name"
						type="text"
						placeholder="Your full name"
						required
						bind:value={$form.name}
						aria-invalid={$errors.name ? 'true' : undefined}
					/>
					{#if $errors.name}
						<div class="mt-2">
							<ErrorBox>
								<p>{$errors.name}</p>
							</ErrorBox>
						</div>
					{/if}
				</div>

				<div class="form-group">
					<Label for="email" class="mb-2 block">Email *</Label>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="your.email@example.com"
						required
						bind:value={$form.email}
						aria-invalid={$errors.email ? 'true' : undefined}
						autocomplete="email"
					/>
					{#if $errors.email}
						<div class="mt-2">
							<ErrorBox>
								<p>{$errors.email}</p>
							</ErrorBox>
						</div>
					{/if}
				</div>
			</div>

			<div class="form-group">
				<Label for="subject" class="mb-2 block">Subject *</Label>
				<Input
					id="subject"
					name="subject"
					type="text"
					placeholder="What is this about?"
					required
					bind:value={$form.subject}
					aria-invalid={$errors.subject ? 'true' : undefined}
				/>
				{#if $errors.subject}
					<div class="mt-2">
						<ErrorBox>
							<p>{$errors.subject}</p>
						</ErrorBox>
					</div>
				{/if}
			</div>

			<div class="form-group">
				<Label for="message" class="mb-2 block">Message *</Label>
				<Textarea
					id="message"
					name="message"
					rows={6}
					placeholder="Tell us more about your question, feedback, or suggestion..."
					required
					bind:value={$form.message}
					aria-invalid={$errors.message ? 'true' : undefined}
				/>
				{#if $errors.message}
					<div class="mt-2">
						<ErrorBox>
							<p>{$errors.message}</p>
						</ErrorBox>
					</div>
				{/if}
			</div>

			<div class="flex flex-col items-center">
				<Button type="submit" disabled={$submitting} color="blue" class="flex items-center gap-2">
					{#if $submitting}
						<iconify-icon icon="material-symbols:hourglass-empty" class="h-4 w-4 animate-spin"
						></iconify-icon>
						Sending...
					{:else}
						<iconify-icon icon="material-symbols:send" class="h-4 w-4"></iconify-icon>
						Send Message
					{/if}
				</Button>
			</div>
		</form>
	</div>
	<div class="flex flex-col items-start gap-4">
		{#if PUBLIC_DISCORD_INVITE_ID}
			<div class="card-bg">
				<div class="contact-info">
					<h3>Better Yet...</h3>
					<p>Join our community on Discord for chat and support!</p>
					<div class="flex justify-center">
						<Button
							href="https://discord.gg/{PUBLIC_DISCORD_INVITE_ID}"
							target="_blank"
							rel="noopener noreferrer"
							color="purple"
							class="my-4 flex items-center gap-2"
						>
							<iconify-icon icon="ic:baseline-discord"></iconify-icon>
							Join Discord Server
						</Button>
					</div>
				</div>
			</div>
		{/if}
		{#if PUBLIC_LIBERAPAY_ID}
			<div class="card-bg">
				<div class="contact-info flex flex-col items-center">
					<h3>Donate</h3>
					<p>Support us with a donation!</p>
					<a href="https://liberapay.com/{PUBLIC_LIBERAPAY_ID}/donate" class="m-4"
						><img
							alt="Donate using Liberapay"
							src="https://liberapay.com/assets/widgets/donate.svg"
						/></a
					>
				</div>
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	h3 {
		@apply text-center;
	}
	.contact-form {
		@apply space-y-6;
	}

	.form-row {
		@apply grid grid-cols-1 gap-4 md:grid-cols-2;
	}
</style>
