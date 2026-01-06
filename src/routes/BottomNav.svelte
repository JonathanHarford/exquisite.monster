<script lang="ts">
	import { SignedIn, SignedOut, SignInButton } from 'svelte-clerk';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import CtaButton from '$lib/components/CtaButton.svelte';
	import type { Player } from '$lib/types/domain';
	import AvatarMenu from '$lib/components/AvatarMenu.svelte';

	let activeUrl = $derived(page.url.pathname);
	let player: Player | undefined = $derived(page.data.self);
</script>

<nav class="fixed bottom-0 left-0 z-30 grid h-16 w-full grid-cols-3 md:hidden">
	<SignedIn>
		<a href={resolve('/g')} class="btn btn-primary flex h-full items-center justify-center"> Gallery </a>
		<div class="flex h-full">
			<CtaButton user={player} />
		</div>
		<AvatarMenu {player} classProps="btn btn-primary flex items-center justify-center p-1 h-full" />
	</SignedIn>
	<SignedOut>
		<a
			href={resolve('/g')}
			class="btn btn-primary flex h-full items-center justify-center"
			class:opacity-75={activeUrl !== resolve('/g')}
		>
			Gallery
		</a>
		<div class="flex h-full">
			<CtaButton user={player} />
		</div>
		<SignInButton mode="modal" class="h-full">
			<div class="btn btn-primary flex h-full w-full items-center justify-center">Sign In</div>
		</SignInButton>
	</SignedOut>
</nav>

<style>
	/* Subtle 3D button effects */
	nav .btn {
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.06),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(0, 0, 0, 0.1);
		transition: all 0.15s ease;
	}

	nav .btn:hover {
		box-shadow:
			0 3px 6px rgba(0, 0, 0, 0.12),
			0 2px 4px rgba(0, 0, 0, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
		transform: translateY(-1px);
	}

	nav .btn:active {
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.15),
			inset 0 2px 4px rgba(0, 0, 0, 0.1);
		transform: translateY(0);
	}
</style>
