<script lang="ts">
	import Debug from '$lib/components/Debug.svelte';
	import ProfilePictureUpload from './ProfilePictureUpload.svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { superForm, dateProxy } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { playerProfileSchema } from '$lib/formSchemata';
	import { Input, Label, Textarea, Alert, Toggle, Helper } from 'flowbite-svelte';
	import { CheckCircleSolid, InfoCircleSolid } from 'flowbite-svelte-icons';
	import SEO from '$lib/components/SEO.svelte';
	import { calculateAge } from '$lib/utils/hlc';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import PartyList from '$lib/components/PartyList.svelte';
	import { invalidate } from '$app/navigation';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	const over18yearsago = (birthday: Date): boolean => {
		return calculateAge(birthday) >= 18;
	};

	// Set up the profile form
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, message, submit, tainted } = superForm(data.form, {
		validators: zod4(playerProfileSchema),
		dataType: 'json',
		onUpdate({ form }) {
			// This ensures the form keeps its values after submission
			if (form.valid) {
				saveSuccess = true;
			}
		},
		resetForm: false
	});

	let saveSuccess = $state(false);
	const isProfileModified = $derived($tainted !== undefined);

	// Create a date proxy for the birthday field that handles empty values
	const birthday = dateProxy(form, 'birthday', {
		format: 'date',
		empty: 'null'
	});

	// Check if user should be forbidden from unchecking lewd content
	let forbidLewdContent = $derived(!$form.birthday || !over18yearsago(new Date($form.birthday)));

	// Reactive statement to ensure hideLewdContent is always true for users under 18 or without birthday
	$effect(() => {
		if (forbidLewdContent) {
			$form.hideLewdContent = true;
		}
	});

	const ctx = useClerkContext();
	const clerkUser = $derived(ctx.user);

	// Email change state
	const currentEmail = $derived(clerkUser?.primaryEmailAddress?.emailAddress || '');
	let newEmail = $state('');
	let verificationCode = $state('');
	let emailChangeStep: 'idle' | 'awaiting_verification' = $state('idle');
	let emailOperationPromise: Promise<void> | undefined = $state(Promise.resolve());
	let emailChangeSuccess: string | null = $state(null);
	let emailValid = $state(true);
	let emailTouched = $state(false);

	// Track if email has changed
	const emailChanged = $derived(
		newEmail.trim() !== '' && newEmail.toLowerCase() !== currentEmail.toLowerCase()
	);

	$effect(() => {
		if (isProfileModified || emailChanged) {
			saveSuccess = false;
		}
	});

	// Reactive validation for email
	$effect(() => {
		if (emailTouched && newEmail) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			emailValid = emailRegex.test(newEmail);
		}
	});

	function validateEmail() {
		emailTouched = true;
		if (!newEmail.trim()) {
			throw new Error('Please enter a new email address.');
		}
		if (!emailValid) {
			throw new Error('Please enter a valid email address.');
		}
		if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
			throw new Error('This is already your current email address.');
		}
		return true;
	}

	async function handleEmailChange() {
		if (!clerkUser) return false;

		validateEmail();

		emailChangeSuccess = null;

		try {
			const existingEmail = clerkUser.emailAddresses.find(
				(e) => e.emailAddress.toLowerCase() === newEmail.toLowerCase()
			);

			if (existingEmail) {
				// If the email is already verified, make it primary
				if (existingEmail.verification?.status === 'verified') {
					await clerkUser.update({ primaryEmailAddressId: existingEmail.id });
					saveSuccess = true;
					resetEmailForm();
					invalidate('app:user');
					return true;
				} else {
					// If the email exists but is unverified, send a new verification code
					await existingEmail.prepareVerification({ strategy: 'email_code' });
					emailChangeStep = 'awaiting_verification';
					emailChangeSuccess = `Verification code sent to ${newEmail}. Please check your inbox and spam folder.`;
					return false; // Need verification
				}
			}

			// Create new email address and send verification code
			const emailAddress = await clerkUser.createEmailAddress({ email: newEmail.trim() });
			await emailAddress.prepareVerification({ strategy: 'email_code' });
			emailChangeStep = 'awaiting_verification';
			emailChangeSuccess = `Verification code sent to ${newEmail}. Please check your inbox and spam folder.`;
			return false; // Need verification
		} catch (err: unknown) {
			console.error('Error adding new email:', err);
			const error = err as { errors?: { message?: string }[]; message?: string };
			throw new Error(error.errors?.[0]?.message || error.message || 'Failed to add new email.');
		}
	}

	async function handleVerifyEmail() {
		if (!clerkUser) return false;
		if (!verificationCode.trim()) {
			throw new Error('Please enter the verification code.');
		}
		emailChangeSuccess = null;

		try {
			const unverifiedEmailAddress = clerkUser.emailAddresses.find(
				(e) =>
					e.verification?.status !== 'verified' &&
					e.emailAddress !== clerkUser.primaryEmailAddress?.emailAddress
			);

			if (!unverifiedEmailAddress) {
				throw new Error('Could not find the email address to verify.');
			}

			const verifiedEmailAddress = await unverifiedEmailAddress.attemptVerification({
				code: verificationCode.trim()
			});

			if (verifiedEmailAddress.verification?.status === 'verified') {
				await clerkUser.update({ primaryEmailAddressId: verifiedEmailAddress.id });
				saveSuccess = true;
				resetEmailForm();
				invalidate('app:user');
				return true;
			} else {
				throw new Error('Email verification failed. The code might be incorrect or expired.');
			}
		} catch (err: unknown) {
			console.error('Error verifying email:', err);
			const error = err as { errors?: { message?: string }[]; message?: string };
			throw new Error(error.errors?.[0]?.message || error.message || 'Failed to verify email.');
		}
	}

	function resetEmailForm() {
		emailChangeStep = 'idle';
		emailOperationPromise = Promise.resolve();
		emailChangeSuccess = null;
		newEmail = '';
		verificationCode = '';
		emailTouched = false;
		emailValid = true;
	}

	// Form element reference
	let formElement: HTMLFormElement;

	// Unified form submission handler
	async function handleUnifiedSubmit(event: SubmitEvent) {
		event.preventDefault();

		emailOperationPromise = (async () => {
			// If we're in email verification step, handle that first
			if (emailChangeStep === 'awaiting_verification') {
				const verified = await handleVerifyEmail();
				if (verified) {
					// Email verified, now submit the profile form
					submit(formElement);
				}
				return;
			}

			// If email changed but not yet sent for verification, handle that
			if (emailChanged) {
				const emailHandled = await handleEmailChange();
				// If email verification is needed, stop here
				if (!emailHandled) {
					return;
				}
			}

			// Submit the profile form (email either unchanged or already handled)
			submit(formElement);
		})();
	}

	function handleKeydown(event: KeyboardEvent) {
		// Prevent submit on enter if we are already loading (via promise state)
		// We can't easily check promise state synchronously without a tracking var,
		// but checking the button state in UI handles it.
		// For the listener, we rely on the button disabled attribute mostly.
		if (event.key === 'Enter') {
			event.preventDefault();
			if (formElement) {
				formElement.requestSubmit();
			}
		}
	}
</script>

<SEO
	title="Account Settings"
	description="Manage your account settings, update your profile, and view your game history."
	noIndex={true}
/>

<div class="account-container">
	<h2 class="account-title">Account Settings</h2>
	<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
		<!-- Left column: Profile pic + Invite (outside form) -->
		<div class="space-y-6 md:col-span-1">
			<ProfilePictureUpload currentImageUrl={data.self.imageUrl} username={data.self.username} />
		</div>
	</div>

	<!-- Main form wraps both columns -->
	<form bind:this={formElement} method="POST" action="?/updateProfile" use:enhance onsubmit={handleUnifiedSubmit}>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
			<!-- Left column form fields -->
			<div class="space-y-6 md:col-span-1">
				<div class="form-group">
					<Label for="username">Username</Label>
					<Input
						id="username"
						name="username"
						type="text"
						placeholder="Your username"
						bind:value={$form.username}
						disabled={emailChanged}
					/>
					{#if $errors.username}<Alert color="red">{$errors.username}</Alert>{/if}
				</div>

				<div class="form-group">
					<Label for="aboutMe">About Me</Label>
					<Textarea
						id="aboutMe"
						name="aboutMe"
						rows={4}
						placeholder="Tell us about yourself..."
						bind:value={$form.aboutMe}
						disabled={emailChanged}
					/>
					{#if $errors.aboutMe}<Alert color="red">{$errors.aboutMe}</Alert>{/if}
				</div>
			</div>

			<!-- Right column form fields -->
			<div class="md:col-span-2 space-y-4">
				<div class="form-group">
					<Label for="websiteUrl">Website</Label>
					<Input
						id="websiteUrl"
						name="websiteUrl"
						type="url"
						placeholder="https://example.com"
						bind:value={$form.websiteUrl}
						disabled={emailChanged}
					/>
					{#if $errors.websiteUrl}<Alert color="red">{$errors.websiteUrl}</Alert>{/if}
				</div>

				<div class="form-group">
					<Label for="birthday">Birthday</Label>
					<Input id="birthday" name="birthday" type="date" bind:value={$birthday} disabled={emailChanged} />
					{#if $errors.birthday}<Alert color="red">{$errors.birthday}</Alert>{/if}
				</div>

				<div>
					<Toggle
						id="hideLewdContent"
						name="hideLewdContent"
						bind:checked={$form.hideLewdContent}
						disabled={forbidLewdContent || emailChanged}
						onchange={() => {
							submit(formElement);
						}}
					>
						Hide lewd content (18+ only)
					</Toggle>
					{#if $errors.hideLewdContent}<Alert color="red">{$errors.hideLewdContent}</Alert>{/if}
				</div>

				{#snippet emailForm(disabled: boolean)}
					{#if emailChangeStep === 'idle'}
						<div class="form-group">
							<Label for="newEmail">Email</Label>
							<Input
								id="newEmail"
								name="newEmail"
								type="email"
								placeholder={currentEmail}
								bind:value={newEmail}
								disabled={disabled || isProfileModified}
								color={emailTouched && !emailValid ? 'red' : 'base'}
								onkeydown={handleKeydown}
								onblur={() => (emailTouched = true)}
								autocomplete="email"
							/>
							{#if emailTouched && !emailValid && newEmail}
								<Helper color="red">Please enter a valid email address</Helper>
							{/if}
						</div>
					{:else}
						<div class="verification-step space-y-4">
							<Alert color="blue">
								<span slot="icon"><InfoCircleSolid class="h-5 w-5" /></span>
								{emailChangeSuccess ||
									"We've sent a verification code to your new email address. Please check your inbox and spam folder."}
							</Alert>

							<div class="form-group">
								<Label for="verificationCode">Verification Code</Label>
								<Input
									id="verificationCode"
									name="verificationCode"
									type="text"
									placeholder="Enter 6-digit code"
									bind:value={verificationCode}
									disabled={disabled}
									onkeydown={handleKeydown}
									autocomplete="one-time-code"
									maxlength={6}
									pattern="[0-9]{6}"
								/>
							</div>

							<button
								type="button"
								onclick={resetEmailForm}
								class="btn btn-secondary text-sm"
								disabled={disabled}
							>
								Cancel Email Change
							</button>
						</div>
					{/if}
				{/snippet}

				<!-- Email Field & Submit Button -->
				<div class="flex flex-col items-center gap-2">
					{#await emailOperationPromise}
						{@render emailForm(true)}
						<button
							type="submit"
							disabled
							class="btn btn-primary"
						>
							<svg
								aria-hidden="true"
								role="status"
								class="me-3 inline h-4 w-4 animate-spin text-white"
								viewBox="0 0 100 101"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
									fill="#E5E7EB"
								/>
								<path
									d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
									fill="currentColor"
								/>
							</svg>
							{emailChangeStep === 'awaiting_verification' ? 'Verifying...' : 'Saving...'}
						</button>
					{:then}
						{@render emailForm(false)}
						<button
							type="submit"
							disabled={(!isProfileModified && !emailChanged)}
							class="btn btn-primary"
						>
							{saveSuccess
								? 'Success!'
								: emailChangeStep === 'awaiting_verification'
									? 'Verify and Save'
									: 'Save Changes'}
						</button>
					{:catch error}
						{@render emailForm(false)}
						<button
							type="submit"
							disabled={(!isProfileModified && !emailChanged)}
							class="btn btn-primary"
						>
							{emailChangeStep === 'awaiting_verification'
								? 'Verify and Save'
								: 'Save Changes'}
						</button>
						<Alert color="red" class="w-full" dismissable on:close={() => (emailOperationPromise = Promise.resolve())}>
							<span slot="icon"><InfoCircleSolid class="h-5 w-5" /></span>
							{error.message || 'An error occurred'}
						</Alert>
					{/await}
				</div>
			</div>
		</div>
	</form>

	<!-- Invite a friend section - after form -->
	<div class="mt-4 flex flex-row items-center justify-center gap-2">
		Invite a friend!
		<ShareButton title="Invite a friend!" customUrl={data.invitationUrl} />
	</div>

	<!-- Active Parties Section -->
	{#if data.activeParties.length > 0}
		<div class="mt-8">
			<h3>Active Parties</h3>
			<PartyList parties={data.activeParties} />
		</div>
	{/if}
</div>
<Debug value={$form} />
<Debug value={clerkUser} />

