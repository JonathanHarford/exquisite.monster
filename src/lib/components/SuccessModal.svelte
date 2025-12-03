<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import SuccessBox from '$lib/components/SuccessBox.svelte';

	const {
		message
	}: {
		message: string;
	} = $props();

	let open = $state(true);
</script>

<Modal bind:open size="md" title="Success" outsideclose>
	<SuccessBox>
		<p>{message}</p>
	</SuccessBox>
	<svelte:fragment slot="footer">
		<button type="button" class="btn btn-primary" onclick={() => (open = false)}>OK</button>
	</svelte:fragment>
</Modal>
