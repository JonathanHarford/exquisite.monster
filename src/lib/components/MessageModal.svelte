<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const messages = {
		'401': 'You need to be logged in to access this page',
		'403': 'You do not have permission to access this page',
		'404': 'The page you are looking for could not be found',
		default: 'An unexpected error occurred',
		turnExpired: 'Your turn has expired. Please start a fresh turn.',
		turnSuccess: "We'll notify you when the game is complete."
	};

	let messageCode = $derived(page.url.searchParams.get('e'));
	let open = $state(false);
	let username = $derived(page.data.self?.username);

	// Sync open state with message code presence
	$effect(() => {
		open = !!messageCode;
	});

	// Handle modal close - remove the message parameter from URL
	function closeModal() {
		if (messageCode) {
			const url = new URL(page.url);
			url.searchParams.delete('e');
			goto(url);
		}
	}

	const getMessage = (code: string) => {
		if (code === 'newPlayer') {
			return `Welcome! Your username is currently ${username}. Please choose a new one and set your profile picture!`;
		}
		return messages[code as keyof typeof messages] || messages.default;
	};
</script>

<Modal bind:open outsideclose on:close={closeModal}>
	<div class="text-center">
		<h3>
			{getMessage(messageCode!)}
		</h3>
	</div>
</Modal>
