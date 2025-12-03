<script lang="ts">
	import { dev } from '$app/environment';
	import { JsonView } from '@zerodevx/svelte-json-view';
	import { appState } from '$lib/appstate.svelte';

	type Props = {
		value: unknown;
		expandLevel?: number; // -1 for fully collapsed
	};

	let { value, expandLevel = -1 }: Props = $props();

	function convertDatesToStrings(obj: unknown): unknown {
		if (obj instanceof Date) {
			return obj.toISOString();
		} else if (Array.isArray(obj)) {
			return obj.map(convertDatesToStrings);
		} else if (typeof obj === 'object' && obj !== null) {
			const result: { [key: string]: unknown } = {};
			for (const key in obj) {
				result[key] = convertDatesToStrings((obj as Record<string, unknown>)[key]);
			}
			return result;
		}
		return obj;
	}
</script>

<!-- REMINDER: type `appState.ui.debug = true` in the console -->
{#if dev && appState.ui.debug}
	<div class="json-debug">
		<JsonView json={convertDatesToStrings(value)} depth={expandLevel}></JsonView>
	</div>
{/if}

<style lang="postcss">
	.json-debug {
		@apply my-1 border border-danger-200 bg-danger-50 font-mono text-xs;
	}
</style>
