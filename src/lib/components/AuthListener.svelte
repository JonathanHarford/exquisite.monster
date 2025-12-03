<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidate } from '$app/navigation';
	import { clearUserData } from '$lib/appstate.svelte';
	import { useClerkContext } from 'svelte-clerk';
	import type { UserResource } from '@clerk/types';

	const { playerId }: { playerId?: string } = $props();
	const clerkCtx = useClerkContext();

	let removeListener: () => void;
	// eslint-disable-next-line svelte/valid-compile
	// svelte-ignore state_referenced_locally
	let lastUserId: string | undefined = $state(playerId);

	$effect(() => {
		if (browser && clerkCtx.clerk && !removeListener) {
			const listener = async (e: { user?: UserResource | null }) => {
				const currentUserId = e.user?.id;

				// Handle sign-out case (user becomes null/undefined)
				if (!currentUserId && lastUserId) {
					console.log('AuthListener: User signed out, clearing data', {
						lastUserId,
						timestamp: new Date().toISOString(),
						userAgent: navigator.userAgent
					});
					clearUserData();
					invalidate('self');
					lastUserId = undefined;
					return;
				}

				// Handle new user sign-in (different user ID)
				if (currentUserId && currentUserId !== lastUserId) {
					console.log('AuthListener: New user signed in, invalidating data', {
						currentUserId,
						lastUserId,
						timestamp: new Date().toISOString(),
						userAgent: navigator.userAgent
					});
					await invalidate('invitation');
					invalidate('self');
					lastUserId = currentUserId;
				}
			};

			console.log('Listening for auth changes');
			removeListener = clerkCtx.clerk.addListener(listener);

			return () => {
				removeListener();
			};
		}
	});
</script>
