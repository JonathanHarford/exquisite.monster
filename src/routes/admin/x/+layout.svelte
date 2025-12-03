<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	const { children }: LayoutProps = $props();
</script>

<nav class="flex justify-around">
	{#each ['example_form', 'fittext', 'party_example'] as file}
		{#if page.url.pathname !== `/admin/x/${file}`}
			<a href={`/admin/x/${file}`}>{file}</a>
		{:else}
			<div>{file}</div>
		{/if}
	{/each}
</nav>
{@render children()}

<style lang="postcss">
	nav {
		a {
			display: block;
			text-decoration: underline;
		}
	}
</style>
