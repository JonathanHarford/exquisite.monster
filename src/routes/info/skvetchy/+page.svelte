<script lang="ts">
	import { onMount } from 'svelte';
	import { Skvetchy } from 'skvetchy';
	import { Button, ButtonGroup } from 'flowbite-svelte';
	import SEO from '$lib/components/SEO.svelte';

	const WIDTH = 1920;
	const HEIGHT = 1080;

	let skvetchyComponent: Skvetchy | null = $state(null);
	let downloadUrl: string | null = $state(null);

	async function handleExport() {
		if (skvetchyComponent) {
			try {
				const blob = await skvetchyComponent.exportToPNG();
				if (blob) {
					// Create a download URL
					if (downloadUrl) {
						URL.revokeObjectURL(downloadUrl);
					}
					downloadUrl = URL.createObjectURL(blob);

					// Trigger download
					const a = document.createElement('a');
					a.href = downloadUrl;
					a.download = `skvetchy-drawing-${Date.now()}.png`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				}
			} catch (error) {
				console.error('Export failed:', error);
				alert('Failed to export drawing. Please try again.');
			}
		}
	}

	function handleClear() {
		if (skvetchyComponent) {
			// Skvetchy should have a clear method, but if not we can reinitialize
			location.reload();
		}
	}

	// Clean up download URL on component destroy
	onMount(() => {
		return () => {
			if (downloadUrl) {
				URL.revokeObjectURL(downloadUrl);
			}
		};
	});
</script>

<SEO
	title="Drawing Applet Test"
	description="Test out our drawing applet - Skvetchy - with layers, undo/redo, and pressure sensitivity"
/>

<p>Practice with the tools before the pressure is on.</p>
<div class="card-bg flex flex-col">
	<Skvetchy
		bind:this={skvetchyComponent}
		imageWidth={WIDTH}
		imageHeight={HEIGHT}
		initialPenSize={15}
	/>
	<p class="text-center text-sm">Tap pen/eraser a second time to resize</p>
	<div class="my-4 flex justify-center">
		<ButtonGroup>
			<Button color="green" onclick={handleExport}>Download Drawing</Button>
			<Button color="red" onclick={handleClear}>Clear Canvas</Button>
		</ButtonGroup>
	</div>
	<p class="text-right text-sm">
		<a href="https://github.com/JonathanHarford/skvetchy">Source</a>
	</p>
</div>
