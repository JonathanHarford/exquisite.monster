<script lang="ts">
	import { Alert } from 'flowbite-svelte';

	interface Props {
		inviterUsername?: string;
		title: string;
	}

	let { inviterUsername, title }: Props = $props();
</script>

<Alert color="blue" class="mb-4">
	<iconify-icon icon="material-symbols:celebration" class="mr-2"></iconify-icon>
	{#if inviterUsername}
		<strong>{inviterUsername}</strong> has invited you to play <strong>{title}</strong>!
	{:else}
		You've been invited to play <strong>{title}</strong>!
	{/if}
</Alert>
