<script lang="ts">
	const { url, label } = $props();
</script>

<div class="absolute right-0 top-0 opacity-10">
	<a href={url} data-sveltekit-reload aria-label={label}>
		<svg version="1.1" width="10" height="10" viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg">
			<path d="M 0 1 L 1 1 L 0 0 L 0 1 Z" fill="currentColor" />
		</svg>
	</a>
</div>
