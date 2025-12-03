<script lang="ts">
	import { Alert } from 'flowbite-svelte';
	import NotificationTestForm from './NotificationTestForm.svelte';
	import GameCreateTestForm from './GameCreateTestForm.svelte';
	import type { ActionResult } from '@sveltejs/kit';

	let { data } = $props();

	let message = $state('');
	let messageType = $state<'success' | 'error'>('success');
	let anyFormBusy = $state(false);

	const handleNotificationResult = (result: ActionResult, formElement: HTMLFormElement) => {
		if (result.type === 'success') {
			message = `Successfully sent test notification!`;
			messageType = 'success';
			formElement.reset();
		} else if (result.type === 'failure') {
			message = (result as any).data?.error || 'Failed to send notification';
			messageType = 'error';
		}

		// Clear message after 5 seconds
		setTimeout(() => {
			message = '';
		}, 5000);
	};

	const handleGameCreateResult = (result: ActionResult, turnCount: 1 | 2) => {
		if (result.type === 'success') {
			message = `Successfully created ${turnCount}-turn test game: ${(result as any).data?.gameId || 'Unknown ID'}`;
			messageType = 'success';
		} else if (result.type === 'failure') {
			message = (result as any).data?.error || 'Failed to create test game';
			messageType = 'error';
		}

		// Clear message after 5 seconds
		setTimeout(() => {
			message = '';
		}, 5000);
	};
</script>

<svelte:head>
	<title>Experiments - Admin Dashboard</title>
</svelte:head>

<div class="container mx-auto max-w-2xl">
	<h2>Experiments</h2>

	<div class="space-y-5">
		<NotificationTestForm
			disabled={anyFormBusy}
			onResult={handleNotificationResult}
			userId={data.userId}
		/>

		<GameCreateTestForm disabled={anyFormBusy} onResult={handleGameCreateResult} />

		{#if message}
			<Alert color={messageType === 'success' ? 'green' : 'red'} class="flex items-center gap-2">
				<iconify-icon
					icon={messageType === 'success'
						? 'material-symbols:check-circle'
						: 'material-symbols:error'}
					class="h-5 w-5"
				></iconify-icon>
				{message}
			</Alert>
		{/if}
	</div>
</div>

<style lang="postcss">
	.container {
		@apply mx-auto max-w-2xl p-5;
	}
</style>
