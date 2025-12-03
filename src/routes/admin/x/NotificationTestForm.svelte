<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button, Input, Label, Textarea, Select } from 'flowbite-svelte';

	let {
		disabled = false,
		onResult,
		userId
	}: {
		disabled?: boolean;
		onResult?: (result: ActionResult, formElement: HTMLFormElement) => void;
		userId?: string;
	} = $props();

	let sendingNotification = $state(false);
	let selectedType = $state('test');
	let title = $state('Test');
	let body = $state(new Date().toLocaleString());
	// svelte-ignore state_referenced_locally
	let targetUserId = $state(userId || '');

	$effect(() => {
		if (userId) {
			targetUserId = userId;
		}
	});

	const handleNotificationSubmit = () => {
		return async ({
			result,
			formElement
		}: {
			result: ActionResult;
			formElement: HTMLFormElement;
		}) => {
			sendingNotification = false;
			onResult?.(result, formElement);
		};
	};

	const notificationTypes = [
		{ value: 'test', name: 'Test' },
		{ value: 'game_completion', name: 'Game Completion' },
		{ value: 'admin_flag', name: 'Admin Flag' },
		{ value: 'flag_rejected', name: 'Flag Rejected' },
		{ value: 'turn_rejected', name: 'Turn Rejected' },
		{ value: 'contact_form', name: 'Contact Form' },
		{ value: 'custom', name: 'Custom' }
	];

	// Update title and body when notification type changes
	$effect(() => {
		const selectedTypeData = notificationTypes.find((type) => type.value === selectedType);
		if (selectedTypeData) {
			title = selectedTypeData.name;
			body = `This is a ${selectedTypeData.name.toLowerCase()} notification sent at ${new Date().toLocaleString()}`;
		}
	});
</script>

<div class="rounded-lg border border-solid border-black">
	<h3>Test Notification</h3>
	<p>Send a test notification to any user to verify the notification system.</p>

	<form
		method="POST"
		action="?/sendTestNotification"
		use:enhance={() => {
			sendingNotification = true;
			return handleNotificationSubmit();
		}}
	>
		<div class="space-y-4">
			<div>
				<Label for="notificationType">Notification Type</Label>
				<Select id="notificationType" name="type" bind:value={selectedType} required>
					{#each notificationTypes as type}
						<option value={type.value}>{type.name}</option>
					{/each}
				</Select>
			</div>

			<div>
				<Label for="targetUserId">User ID</Label>
				<Input
					id="targetUserId"
					name="targetUserId"
					placeholder="Enter user ID"
					required
					bind:value={targetUserId}
				/>
			</div>

			<div>
				<Label for="notificationTitle">Title</Label>
				<Input
					id="notificationTitle"
					name="title"
					placeholder="Enter notification title"
					required
					bind:value={title}
				/>
			</div>

			<div>
				<Label for="notificationBody">Message</Label>
				<Textarea
					id="notificationBody"
					name="body"
					placeholder="Enter notification message"
					required
					rows={3}
					bind:value={body}
				/>
			</div>

			<div>
				<Label for="notificationActionUrl">Action URL (optional)</Label>
				<Input
					id="notificationActionUrl"
					name="actionUrl"
					placeholder="Optional URL for notification action (e.g., /g/gameId)"
				/>
			</div>

			<div>
				<Label for="notificationData">Additional Data (JSON, optional)</Label>
				<Textarea id="notificationData" name="data" placeholder="Optional JSON data" rows={3} />
			</div>

			<Button
				type="submit"
				disabled={disabled || sendingNotification}
				color="purple"
				class="flex items-center gap-2"
			>
				{#if sendingNotification}
					<iconify-icon icon="material-symbols:hourglass-empty" class="h-4 w-4 animate-spin"
					></iconify-icon>
					Sending...
				{:else}
					<iconify-icon icon="material-symbols:notifications" class="h-4 w-4"></iconify-icon>
					Send Test Notification
				{/if}
			</Button>
		</div>
	</form>
</div>
