<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { useClerkContext } from 'svelte-clerk';

	const clerk = useClerkContext();

	// Handle auth loss with automatic retry
	$effect(() => {
		if (clerk.isLoaded && clerk.user) {
			console.warn('AuthRecovery: self is null, but Clerk session exists. Attempting recovery.', {
				timestamp: new Date().toISOString(),
				userAgent: navigator.userAgent,
				currentPath: window.location.pathname
			});

			// Use invalidate to re-run all load functions and fetch all data from the server
			// without a full page reload.
			console.log('Attempting auth recovery in 2 seconds via invalidateAll()');
			setTimeout(() => {
				console.log('Retrying auth recovery via invalidateAll()');
				invalidateAll();
			}, 2000);
		}
	});
</script>
