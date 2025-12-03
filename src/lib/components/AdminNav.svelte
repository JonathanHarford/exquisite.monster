<script lang="ts">
	import { page } from '$app/state';
	import { appState } from '$lib/appstate.svelte';
	import type { Player } from '@prisma/client';
	import { onMount } from 'svelte';

	const self: Player | null = $derived(page.data.self);
	let show = $state(true);

	const currentPath = $derived(page.url.pathname);

	onMount(() => {
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.altKey && event.key === 'z') {
				event.preventDefault();
				appState.ui.debug = !appState.ui.debug;
			}
		};
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	const tabItems = $derived([
		{
			label: 'Dash',
			href: '/admin',
			active: currentPath.startsWith('/admin')
		},
		{
			label: 'Games',
			href: '/admin/games',
			active: currentPath.startsWith('/admin/games')
		},
		{
			label: 'Players',
			href: '/admin/players',
			active: currentPath.startsWith('/admin/players')
		},
		{
			label: 'Parties',
			href: '/admin/parties',
			active: currentPath.startsWith('/admin/parties')
		},
		{
			label: 'Settings',
			href: '/admin/settings',
			active: currentPath.startsWith('/admin/settings')
		},
		{
			label: 'Anal',
			href: '/admin/analytics',
			active: currentPath.startsWith('/admin/analytics')
		},
		{
			label: 'Exp',
			href: '/admin/x',
			active: currentPath.startsWith('/admin/x')
		}
	]);
</script>

{#if self?.isAdmin && show}
	<div class="admin-nav flex flex-row justify-end gap-2 px-2 text-xs">
		{#each tabItems as item}
			<a href={item.href} class={item.active ? 'underline' : ''}>
				{item.label}
			</a>
		{/each}
	</div>
{/if}
