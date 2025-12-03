<script lang="ts">
	import { type Snippet } from 'svelte';
	import 'iconify-icon';
	import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton } from 'svelte-clerk';
	import { Navbar, NavBrand, NavLi, NavUl } from 'flowbite-svelte';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_SITE_TITLE } from '$env/static/public';
	import '../app.postcss';
	import BottomNav from './BottomNav.svelte';
	import Footer from './Footer.svelte';
	import MessageModal from '$lib/components/MessageModal.svelte';
	import NotificationListener from '$lib/components/NotificationListener.svelte';
	import { appState } from '$lib/appstate.svelte';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	// import Debug from '$lib/components/Debug.svelte'; // Unused
	import type { PageData } from './$types';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';
	import CtaButton from '$lib/components/CtaButton.svelte';

	import { Timer } from '$lib/Timer.svelte';
	// import SoundPlayer from '$lib/components/SoundPlayer.svelte'; // Unused
	import { timeUntil } from '$lib/datetime';
	import AnimatedBackground from '$lib/components/AnimatedBackground.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import AuthListener from '$lib/components/AuthListener.svelte';
	import { SETTINGS } from '$lib/constants';
	import AdminNav from '$lib/components/AdminNav.svelte';
	import InvitationAlert from '$lib/components/InvitationAlert.svelte';
import AuthRecovery from '$lib/components/AuthRecovery.svelte';

	const { data, children }: { data: PageData; children: Snippet } = $props();
	const { pendingGame, pendingTurn, pendingPartyTurnCount } = $derived(data);


	let warningTimer: Timer | undefined = undefined;
	let currentMainTimer: Timer | undefined = undefined;

	beforeNavigate(() => {
		appState.ui.loading = true;
	});
	afterNavigate(() => {
		appState.ui.loading = false;

		// If the current page's data does not include a pendingTurn,
		// ensure the global pendingTurn state for the UI is cleared.
		if (!data.pendingTurn) {
			appState.play.pendingTurn = undefined;
			// No need to directly set appState.timer = undefined here,
			// as the CountdownTimer component's onDestroy and the main timer effect's
			// cleanup (triggered by data.pendingTurn changing) should handle it.
		}
	});

	// Initialize notification unread count from server data (only when data changes)
	$effect(() => {
		if (typeof data.unreadNotificationCount === 'number') {
			appState.notificationStore.unreadCount = data.unreadNotificationCount;
		}
	});

	// Handle play state and timer management (only when game/pendingTurn changes)
	$effect(() => {
		appState.play = {
			game: pendingGame,
			pendingTurn,
			pendingPartyTurnCount
		};

		// Clean up existing timers
		if (currentMainTimer) {
			currentMainTimer.cleanup();
			currentMainTimer = undefined;
		}
		if (warningTimer) {
			warningTimer.cleanup();
			warningTimer = undefined;
		}

		if (pendingGame && pendingTurn && pendingTurn.expiresAt && !pendingGame.seasonId) {
			const timeRemaining = timeUntil(pendingTurn.expiresAt);

			if (timeRemaining <= 0) {
				// If the turn has already expired, redirect immediately.
				goto('/?e=turnExpired', { invalidate: ['self'] });
				return; // Stop further execution in this effect
			}

			currentMainTimer = new Timer(timeRemaining, () => {
				appState.audio = '/audio/alarm.wav';
				appState.ui.timerSoon = false;
				goto('/?e=turnExpired', { invalidate: ['self'] });
			});
			warningTimer = new Timer((3 * timeRemaining) / 4, () => {
				appState.audio = '/audio/stopwatch.wav';
				appState.ui.timerSoon = true;
			});
		}

		// Update appState with the current timer (this should not cause a loop since we're not reading from appState.timer)
		appState.timer = currentMainTimer;

		// Cleanup function for when the effect re-runs or component unmounts
		return () => {
			if (currentMainTimer) {
				currentMainTimer.cleanup();
			}
			if (warningTimer) {
				warningTimer.cleanup();
			}
		};
	});
</script>

<!-- Default SEO - pages can override with their own SEO component -->
<SEO />
<AnimatedBackground />
<ClerkProvider publishableKey={PUBLIC_CLERK_PUBLISHABLE_KEY}>
	<MessageModal />
	<!-- <SoundPlayer /> -->
	<div class="flex min-h-screen flex-col">
		<Navbar shadow class="mb-2 bg-gradient-to-r from-primary-100 to-warning-100 py-0">
			<NavBrand href="/">
				<enhanced:img
					src="$lib/assets/img/exmo-logo.png?w=64"
					class="logo mr-2"
					class:spinning={appState.ui.loading}
					alt="Logo"
				/>

				<div class="flex flex-col">
					<h1 class="{appState.ui.loading ? 'text-primary-400' : 'text-black'} no-underline">
						{PUBLIC_SITE_TITLE}
					</h1>
					{#if data.activeGamesCount > 0 && data.activeGamesCount >= SETTINGS.ACTIVE_GAME_COUNT_MIN}
						<div class="text-sm text-primary-700" style="margin-top: -0.3rem;">
							{data.activeGamesCount} active {data.activeGamesCount === 1 ? 'game' : 'games'}!
						</div>
					{/if}
				</div>
			</NavBrand>

			<!-- Desktop Navigation -->
			<NavUl ulClass="hidden md:flex flex-row items-center gap-4">
				<NavLi href="/g">Gallery</NavLi>
				<SignedIn>
					<AuthListener playerId={data.self?.id} />
					<NotificationListener />
					<CtaButton user={data.self} class="w-auto" />
					<NavLi>
						<AvatarMenu player={data.self} />
					</NavLi>
				</SignedIn>
				<SignedOut>
					<CtaButton user={data.self} />
					<NavLi>
						<SignInButton mode="modal">
							<div class="btn btn-primary whitespace-nowrap">Sign In</div>
						</SignInButton>
					</NavLi>
					<NavLi>
						<SignUpButton mode="modal">
							<div class="btn btn-primary whitespace-nowrap">Sign Up</div>
						</SignUpButton>
					</NavLi>
				</SignedOut>
			</NavUl>
		</Navbar>
		<AdminNav />
		<main class="p-2">
			<SignedOut>
				{#if data.inviterInfo?.username}
					<InvitationAlert
						inviterUsername={(data as any).inviterInfo.username}
						title={PUBLIC_SITE_TITLE}
					/>
				{/if}
			</SignedOut>
			{@render children?.()}
		</main>

		<Footer />
	</div>
	<BottomNav />
	{#if !data.self}
		<AuthRecovery />
	{/if}
</ClerkProvider>

<style lang="postcss">
	main {
		@apply container mx-auto flex flex-col;
	}
	:global(.cl-userButtonPopoverFooter),
	:global(.cl-userPreview) {
		display: none;
	}
	:global(.cl-avatarBox) {
		@apply aspect-square h-12 w-12;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.spinning {
		animation: spin 60s linear infinite;
	}

	.logo {
		filter: drop-shadow(1px 3px 2px rgba(0, -40px, 0, 0.8));
	}
</style>
