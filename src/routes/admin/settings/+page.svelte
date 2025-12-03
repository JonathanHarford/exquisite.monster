<script lang="ts">
	import SiteConfigForm from './SiteConfigForm.svelte';
	import StorageCleanupControls from './StorageCleanupControls.svelte';
	import { Heading } from 'flowbite-svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	let { siteConfigForm } = $derived(data);
</script>

<svelte:head>
	<title>Settings - Admin Dashboard</title>
</svelte:head>

<div class="settings-page space-y-8">
	<div>
		<Heading tag="h2">Settings</Heading>
		<p>Configure site-wide settings and default game parameters</p>
	</div>

	<section class="space-y-4">
		<Heading tag="h3">Default Game Configuration</Heading>
		<p>Configure default settings for new games</p>
		<SiteConfigForm formData={siteConfigForm} />
	</section>

	<section class="space-y-4">
		<Heading tag="h3">Storage Management</Heading>
		<p>Clean up temporary and orphaned files to free up storage space</p>
		<StorageCleanupControls />
	</section>
</div>

<style lang="postcss">
</style>
