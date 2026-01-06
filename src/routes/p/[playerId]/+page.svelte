<script lang="ts">
	import { Avatar, Badge, Button, ButtonGroup } from 'flowbite-svelte';
	import DateComponent from '$lib/components/DateComponent.svelte';
	import { resolve } from '$app/paths';
	import FavoriteButton from '$lib/components/FavoriteButton.svelte';
	import Speechbubble from '$lib/components/Speechbubble.svelte';
	import GameCard from '$lib/components/GameCard.svelte';
	import type { PageProps } from './$types';
	import SEO from '$lib/components/SEO.svelte';
	import PlayerAdminControls from './PlayerAdminControls.svelte';

	const { data }: PageProps = $props();
	const { player } = $derived(data);
</script>

<SEO
	title={`${player.username} - Profile`}
	description={`View ${player.username}'s profile`}
	type="profile"
	image={player.imageUrl}
/>

<h2 class="flex flex-row items-center justify-center gap-4">
	{#if player.isAdmin}
		<Badge color="red">
			<iconify-icon icon="eos-icons:admin" class="h-3 w-3"></iconify-icon>
			Admin
		</Badge>
	{/if}
	<div>{player.username}</div>
	<FavoriteButton
		type="player"
		id={player.id}
		isFavorited={player.isFavoritedByCurrentUser}
		favoriteCount={player.favoriteCount}
		customAction="?/favoritePlayerAction"
	/>
</h2>
<div class="flex w-full flex-row justify-between text-sm">
	<div>
		Joined <DateComponent date={player.createdAt} />
	</div>

	{#if player.websiteUrl}
		<div>
			<a href={player.websiteUrl} target="_blank" rel="noopener noreferrer">
				<iconify-icon icon="material-symbols:link" class="h-4 w-4"></iconify-icon>
				{player.websiteUrl}
			</a>
		</div>
	{/if}
</div>
<div class="flex items-center gap-4 py-4">
	<Avatar
		src={player.imageUrl}
		data-name={player.username}
		size="xl"
		border
		class="ring-neutral-100"
	/>

	{#if player.aboutMe}
		<Speechbubble direction="left" className="about-me-bubble text-xl">
			{#snippet children()}
				<p class="whitespace-pre-line">{player.aboutMe}</p>
			{/snippet}
		</Speechbubble>
	{:else}
		<p class="italic">
			{player.username} hasn't written anything about themselves yet.
		</p>
	{/if}
</div>

<!-- Tab Navigation with ButtonGroup -->

<ButtonGroup class="mb-4 flex justify-center">
	<Button
		href="?tab=faved-games"
		color={data.activeTab === 'faved-games' ? 'blue' : 'light'}
		class="text-lg"
	>
		Faved Games
	</Button>
	<Button
		href="?tab=played-games"
		color={data.activeTab === 'played-games' ? 'blue' : 'light'}
		class="text-lg"
	>
		Played Games
	</Button>
	<Button
		href="?tab=faved-players"
		color={data.activeTab === 'faved-players' ? 'blue' : 'light'}
		class="text-lg"
	>
		Faved Players
	</Button>
</ButtonGroup>

<!-- Tab Content -->
<div class="w-full">
	{#if data.activeTab === 'faved-games'}
		<div class="favorited-games-section">
			{#if 'games' in data && data.games && Array.isArray(data.games) && data.games.length > 0}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
					{#each data.games as game (game.id)}
						<GameCard {game} />
					{/each}
				</div>

				<!-- Pagination for favorited games -->
				{#if 'totalPages' in data && data.totalPages && (data.totalPages as number) > 1}
					<div class="mt-4 flex items-center justify-between gap-4">
						{#if data.currentPage > 1}
							<Button href="?page={data.currentPage - 1}&tab=faved-games">Previous</Button>
						{/if}
						<div>
							Page {data.currentPage} of {data.totalPages}
						</div>
						{#if data.currentPage < (data.totalPages as number)}
							<Button href="?page={data.currentPage + 1}&tab=faved-games">Next</Button>
						{/if}
					</div>
				{/if}
			{:else}
				<div class="empty-favorites py-8 text-center">
					<iconify-icon icon="material-symbols:joystick-outline" class="mx-auto h-12 w-12"
					></iconify-icon>
					<p class="mt-2">
						{data.isOwnProfile ? "You haven't" : `${player.username} hasn't`} favorited any games yet.
					</p>
					{#if data.isOwnProfile}
						<p class="text-sm">
							<a href={resolve('/g')} class="link">Explore games</a> and click the favorite button to add them here.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{:else if data.activeTab === 'played-games'}
		<div class="played-games-section">
			{#if 'games' in data && data.games && Array.isArray(data.games) && data.games.length > 0}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
					{#each data.games as game (game.id)}
						<GameCard {game} />
					{/each}
				</div>

				<!-- Pagination for played games -->
				{#if 'totalPages' in data && data.totalPages && (data.totalPages as number) > 1}
					<div class="mt-4 flex items-center justify-between gap-4">
						{#if data.currentPage > 1}
							<Button href="?page={data.currentPage - 1}&tab=played-games">Previous</Button>
						{/if}
						<div>
							Page {data.currentPage} of {data.totalPages}
						</div>
						{#if data.currentPage < (data.totalPages as number)}
							<Button href="?page={data.currentPage + 1}&tab=played-games">Next</Button>
						{/if}
					</div>
				{/if}
			{:else}
				<div class="empty-games py-8 text-center">
					<iconify-icon icon="material-symbols:joystick-outline" class="mx-auto h-12 w-12"
					></iconify-icon>
					<p class="mt-2">No games visible.</p>
					{#if data.isOwnProfile}
						<p class="text-sm">
							You haven't played any games yet. Click the Play button to start your first game!
						</p>
					{:else}
						<p class="text-sm">You haven't played in any games with {player.username}.</p>
					{/if}
				</div>
			{/if}
		</div>
	{:else if data.activeTab === 'faved-players'}
		<div class="favorited-players-section">
			{#if 'players' in data && data.players && Array.isArray(data.players) && data.players.length > 0}
				<div class="flex flex-wrap gap-3">
					{#each data.players as player}
						<a href={resolve('/p/[playerId]', { playerId: player.id })} class="favorite-player-avatar">
							<Avatar
								src={player.imageUrl}
								data-name={player.username}
								size="xl"
								border
								class="transition-all hover:ring-2 hover:ring-neutral-300"
							/>
						</a>
					{/each}
				</div>

				<!-- Pagination for favorited players -->
				{#if 'totalPages' in data && data.totalPages && (data.totalPages as number) > 1}
					<div class="mt-4 flex items-center justify-between gap-4">
						{#if data.currentPage > 1}
							<Button href="?page={data.currentPage - 1}&tab=faved-players">Previous</Button>
						{/if}
						<div>
							Page {data.currentPage} of {data.totalPages}
						</div>
						{#if data.currentPage < (data.totalPages as number)}
							<Button href="?page={data.currentPage + 1}&tab=faved-players">Next</Button>
						{/if}
					</div>
				{/if}
			{:else}
				<div class="empty-favorites py-8 text-center">
					<iconify-icon icon="material-symbols:person-add-outline" class="mx-auto h-12 w-12"
					></iconify-icon>
					<p class="mt-2">
						{data.isOwnProfile ? "You haven't" : `${player.username} hasn't`} favorited any players yet.
					</p>
					{#if data.isOwnProfile}
						<p class="text-sm">
							Visit player profiles and click the favorite button to add them here.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Admin Link -->
{#if data.self?.isAdmin}
	<div class="mt-4">
		<PlayerAdminControls {data} form={data.form} />
	</div>
{/if}

<style lang="postcss">
	:global(.about-me-bubble) {
		@apply flex w-max flex-col items-center justify-center self-stretch p-2 text-xl md:text-2xl;
		max-width: 400px; /* Prevent the bubble from getting too wide */
	}

	.empty-games,
	.empty-favorites {
		@apply py-8 text-center;
	}

	.favorite-player-avatar {
		@apply block;
	}
</style>
