<script lang="ts">
	import type { Player } from '$lib/types/domain';
	import { useClerkContext } from 'svelte-clerk';
	import { Drawer, Badge, Avatar, Button, Indicator } from 'flowbite-svelte';
	import { MessageDotsOutline } from 'flowbite-svelte-icons';
	import { appState } from '$lib/appstate.svelte';
	import { clearUserData } from '$lib/appstate.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';

	const { player, classProps }: { player: Player | null | undefined; classProps?: string } =
		$props();
	const clerkCtx = useClerkContext(); // Use the context hook

	// State to control drawer open/close (Drawer uses hidden instead of open)
	let drawerHidden = $state(true);

	async function handleSignOut() {
		try {
			// Clear client-side state before signing out to prevent data leakage
			clearUserData();

			// The context should provide the Clerk instance, which should have signOut
			// The exact structure of the context (clerk.client vs clerk directly) might vary
			if (clerkCtx && clerkCtx.clerk) {
				await clerkCtx.clerk.signOut();
			} else {
				console.error('Clerk instance or signOut method not available via useClerkContext.');
			}

			// Invalidate all SvelteKit caches to ensure fresh data on next login
			if (browser) {
				await invalidateAll();

				// Navigate to home page to ensure clean state
				// Use replace to avoid back button issues
				await goto('/', { replaceState: true, invalidateAll: true });
			}
		} catch (error) {
			console.error('Error during sign out:', error);
			// Even if sign out fails, try to navigate to a clean state
			if (browser) {
				try {
					await goto('/', { replaceState: true, invalidateAll: true });
				} catch (navError) {
					console.error('Navigation after failed sign out also failed:', navError);
					// As a last resort, reload the page to ensure clean state
					window.location.href = '/';
				}
			}
		}
	}

	// Function to close drawer when a link is clicked
	function closeDrawer() {
		drawerHidden = true;
	}

	// Function to open drawer
	function openDrawer() {
		drawerHidden = false;
	}
</script>

{#if player}
	<svelte:boundary onerror={(error) => console.warn('Avatar menu error:', error)}>
		<div class="flex items-center {classProps}">
			<button
				class="avatar-menu-button relative flex items-center rounded-full"
				type="button"
				name="Open Avatar Menu"
				data-testid="avatar-menu"
				onclick={openDrawer}
			>
				<div class="relative">
					<Avatar
						src={player.imageUrl}
						data-name={player.username}
						class="h-12 w-12"
					/>
					{#if appState.notificationStore.unreadCount > 0}
						<Indicator color="red" placement="top-right">
							<MessageDotsOutline class="text-white h-4 w-4" />
						</Indicator>
					{/if}
				</div>
			</button>

			<Drawer
				placement="right"
				transitionType="fly"
				bind:hidden={drawerHidden}
				backdrop={true}
				activateClickOutside={true}
				class="flex w-80 flex-col justify-end py-4 pb-20 text-right text-2xl sm:justify-start sm:text-base"
			>
				<!-- Menu Items -->
				<nav>
					<a href="/account/mail" onclick={closeDrawer}>
						<span>Notifications</span>
						{#if appState.notificationStore.unreadCount > 0}
							<Badge color="red" rounded>{appState.notificationStore.unreadCount}</Badge>
						{/if}
					</a>

					<a href="/account" onclick={closeDrawer}>
						<span>Account Settings</span>
					</a>

					<hr />

					<Button
						on:click={handleSignOut}
						color="red"
						class="w-full justify-start text-center text-lg"
					>
						Sign Out
					</Button>
				</nav>
			</Drawer>
		</div>
	</svelte:boundary>
{/if}

<style lang="postcss">
	nav a {
		@apply flex items-center justify-between rounded-lg p-2 text-primary-900;
	}
</style>
