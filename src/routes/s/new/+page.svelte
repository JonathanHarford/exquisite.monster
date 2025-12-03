<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms/client';
	import { zod4 } from 'sveltekit-superforms/adapters';
	import { partyCreationSchema } from '$lib/formSchemata';
	import { page } from '$app/state';
	import Seo from '$lib/components/SEO.svelte';
	import ErrorBox from '$lib/components/ErrorBox.svelte';
	import { Input, Button, Modal } from 'flowbite-svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import PartyList from '$lib/components/PartyList.svelte';

	let { data }: PageProps = $props();

	// Modal state for inviting players
	let showInviteModal = $state(false);

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting } = superForm(data.form, {
		validators: zod4(partyCreationSchema)
	});
</script>

<Seo
	title="Create New Party"
	description="Set up a new party where players can participate in interconnected games together."
/>

<div class="min-h-screen">
	<div class="mx-auto flex flex-col gap-4">
		<h2>What Is Party Mode?</h2>

		<p>
			Playing one turn in a game with randos is fun, but <b>Party Mode</b> is the <i>best</i> way to
			play <b>Eat Poop You Cat</b> online.
		</p>
		<p>
			It works just like playing it at a party with your friends: Each of you writes an opener, and
			the games get passed around until everyone's played in every game!
		</p>
		<p>
			No time limits! Take as much time as you need to draw the perfect picture (or compose the
			perfect piece of writing).
		</p>

		{#if data.activeParties.length > 0}
			<div class="my-4 card">
				<h3>Active Parties</h3>
				<PartyList parties={data.activeParties} />
			</div>
		{/if}

		{#if data.hasEnoughFriends}
			<form method="POST" action="?/create" use:enhance class="card space-y-2">
				<h3>Create a New Party</h3>
				<!-- Hidden field for turnPassingAlgorithm -->
				<input type="hidden" name="turnPassingAlgorithm" bind:value={$form.turnPassingAlgorithm} />

				<div>
					<label for="title">Party Title</label>
					<Input
						type="text"
						id="title"
						name="title"
						bind:value={$form.title}
						placeholder="Enter a name for your party"
						required
					/>
					{#if $errors.title}
						<ErrorBox>{$errors.title}</ErrorBox>
					{/if}
				</div>

				<div>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="allowPlayerInvites"
							bind:checked={$form.allowPlayerInvites}
							class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
						/>
						Allow invited players to invite others
					</label>
					{#if $errors.allowPlayerInvites}
						<ErrorBox>{$errors.allowPlayerInvites}</ErrorBox>
					{/if}
				</div>

				<div class="flex justify-end gap-3">
					<a href="/account" class="btn">Cancel</a>
					<button class="btn btn-primary" type="submit" disabled={$submitting}>
						{$submitting ? 'Creating...' : 'Create Party'}
					</button>
				</div>

				{#if page.form?.error}
					<ErrorBox>{page.form.error}</ErrorBox>
				{/if}
			</form>
		{:else}
			<div class="card flex flex-col items-stretch gap-2 bg-danger-100 p-4 text-center">
				<h3>You need more friends to create a party!</h3>
				<p>To create a party, you need at least 1 favorite player to invite.</p>
				<p>
					You currently have {data.favoritePlayersResult.length} favorite players.
				</p>
				<div class="flex justify-between">
					<div class="flex items-center gap-2">
						<ShareButton title="Invite a friend!" customUrl={data.invitationUrl} />
						Invite a friend to the site!
					</div>
					<div class="flex items-center gap-2">
						or...
						<a href="/play" class="btn btn-primary"> Play (non-party) </a>
					</div>
				</div>
			</div>
		{/if}


	</div>
</div>

<style lang="postcss">
	label {
		font-size: 1rem;
	}
</style>
