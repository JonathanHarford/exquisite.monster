<script lang="ts">
	import { SignedIn, SignedOut, SignUpButton } from 'svelte-clerk';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SEO from '$lib/components/SEO.svelte';
	import SuccessModal from '$lib/components/SuccessModal.svelte';
	import GameGallery from '$lib/components/GameGallery.svelte';
	import type { PageProps } from './$types';

	import { PUBLIC_SITE_TITLE } from '$env/static/public';

	const { data }: PageProps = $props();

	// Check if we're coming from a successful flag action
	const showFlagSuccess = $derived(page.url.searchParams.get('flagSuccess') === 'true');
</script>

<SEO
	description="{PUBLIC_SITE_TITLE} is an adaptation of the objectively best party game of writing and drawing, Eat Poop You Cat."
/>

{#if showFlagSuccess}
	<SuccessModal message="Thank you for your report. We will review it shortly." />
{/if}

<div class="flex flex-col items-center">
	<section class="mt-20 text-center">
		<p>
			<strong>{PUBLIC_SITE_TITLE}</strong> is an adaptation of the <i>objectively best</i> party
			game of writing and drawing, <b>Eat Poop You Cat</b>
			<a
				href="https://boardgamegeek.com/boardgame/30618/eat-poop-you-cat"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-block align-middle"
				aria-label="Learn more about Eat Poop You Cat on BoardGameGeek"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="inline h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
					/>
				</svg>
			</a>.
		</p>
		<p class="text-sm">(I know, I'm sorry, I didn't name it.)</p>
		<div class="flex justify-center gap-4 text-xl text-danger-700">
			<div>✍️</div>
			<div>👉️</div>
			<div>🎨</div>
			<div>👉️</div>
			<div>✍️</div>
			<div>👉️</div>
			<div>...</div>
			<div>👉️</div>
			<div>⁉️</div>
		</div>
		<div class="mx-auto mb-3 flex items-baseline gap-4">
			<a href={resolve('/info/about')} class="btn btn-primary">How To Play</a>
			<SignedIn>
				<a href={resolve('/play')} class="btn btn-primary" aria-label="Play"> Play </a>
			</SignedIn>
			<SignedOut>
				<SignUpButton mode="modal">
					<div class="btn btn-primary mx-auto mt-4">Play</div>
				</SignUpButton>
			</SignedOut>
		</div>
		<p class="text-sm">
			<i>Low commitment:</i> When you click <i>Play</i> you'll be matched with a game in which
			you'll be asked to play <i>a single turn</i> of writing or drawing.
		</p>
	</section>
	<a href={resolve('/g')}><h2 class="mt-12">Past Games</h2></a>
	<GameGallery games={data.games || []} />
</div>
