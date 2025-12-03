<script lang="ts">
	import { page } from '$app/state';
	import Debug from '$lib/components/Debug.svelte';
</script>

<div class="flex h-screen flex-col items-center justify-center gap-8">
	<h2>{page.error?.message}</h2>

	<p>😭</p>

	<Debug value={page.error} expandLevel={2} />
</div>
