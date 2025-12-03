<script lang="ts">
	import { Popover } from 'flowbite-svelte';
	import { page } from '$app/state';

	interface Props {
		title: string;
		customUrl?: string;
	}

	let { title, customUrl }: Props = $props();
	const urlTitle = $derived(encodeURIComponent(title));
	const url = $derived(customUrl || page.url.toString());
	let copied = $state(false);

	async function copyToClipboard() {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<button
	data-popover-target="share-popover"
	class="btn btn-primary flex items-center justify-center"
	aria-label={title}
	{title}
>
	<iconify-icon icon="material-symbols:share-outline" class="share-icon"></iconify-icon>
</button>

<Popover triggeredBy="[data-popover-target='share-popover']" placement="top" class="w-auto p-3">
	<div class="share-popover">
		<h3 class="share-title">{title}</h3>
		<div class="share-buttons-grid">
			<!-- Copy to Clipboard -->
			<button
				onclick={copyToClipboard}
				class="share-btn copy"
				title="Copy to Clipboard"
				aria-label="Copy to Clipboard"
			>
				{#if copied}
					<iconify-icon icon="lucide:check"></iconify-icon>
				{:else}
					<iconify-icon icon="lucide:copy"></iconify-icon>
				{/if}
			</button>

			<!-- Email -->
			<a
				href="mailto:?subject={urlTitle}&body={encodeURIComponent(`${title}\n\n${url}`)}"
				class="share-btn email"
				title="Share via Email"
				aria-label="Share via Email"
			>
				<iconify-icon icon="material-symbols:mail-outline"></iconify-icon>
			</a>

			<!-- Facebook -->
			<a
				href="https://www.facebook.com/sharer.php?u={encodeURIComponent(url)}"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn facebook"
				title="Share on Facebook"
				aria-label="Share on Facebook"
			>
				<iconify-icon icon="simple-icons:facebook"></iconify-icon>
			</a>

			<!-- Reddit -->
			<a
				href="https://reddit.com/submit?url={encodeURIComponent(url)}&title={urlTitle}"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn reddit"
				title="Share on Reddit"
				aria-label="Share on Reddit"
			>
				<iconify-icon icon="simple-icons:reddit"></iconify-icon>
			</a>

			<!-- WhatsApp -->
			<a
				href="https://api.whatsapp.com/send?text={encodeURIComponent(`${title} ${url}`)}"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn whatsapp"
				title="Share on WhatsApp"
				aria-label="Share on WhatsApp"
			>
				<iconify-icon icon="simple-icons:whatsapp"></iconify-icon>
			</a>

			<!-- Pinterest -->
			<a
				href="http://pinterest.com/pin/create/button/?url={encodeURIComponent(url)}"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn pinterest"
				title="Share on Pinterest"
				aria-label="Share on Pinterest"
			>
				<iconify-icon icon="simple-icons:pinterest"></iconify-icon>
			</a>

			<!-- Tumblr -->
			<a
				href="https://www.tumblr.com/widgets/share/tool?canonicalUrl={encodeURIComponent(
					url
				)}&title={urlTitle}&caption={urlTitle}"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn tumblr"
				title="Share on Tumblr"
				aria-label="Share on Tumblr"
			>
				<iconify-icon icon="simple-icons:tumblr"></iconify-icon>
			</a>

			<!-- Bluesky -->
			<a
				href="https://bsky.app/intent/compose?text={encodeURIComponent(`${title} ${url}`)}"
				target="_blank"
				rel="noopener noreferrer"
				class="share-btn bluesky"
				title="Share on Bluesky"
				aria-label="Share on Bluesky"
			>
				<iconify-icon icon="simple-icons:bluesky"></iconify-icon>
			</a>
		</div>
	</div>
</Popover>

<style lang="postcss">
	.share-popover {
		@apply text-center;
	}

	.share-buttons-grid {
		@apply grid grid-cols-4 gap-2;
	}

	:global(.share-btn) {
		@apply flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2;
	}

	:global(.share-btn.reddit) {
		@apply bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500;
	}

	:global(.share-btn.email) {
		@apply bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500;
	}

	:global(.share-btn.facebook) {
		@apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500;
	}

	:global(.share-btn.whatsapp) {
		@apply bg-green-500 text-white hover:bg-green-600 focus:ring-green-500;
	}

	:global(.share-btn.telegram) {
		@apply bg-blue-400 text-white hover:bg-blue-500 focus:ring-blue-400;
	}

	:global(.share-btn.pinterest) {
		@apply bg-red-600 text-white hover:bg-red-700 focus:ring-red-500;
	}

	:global(.share-btn.tumblr) {
		@apply bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500;
	}

	:global(.share-btn.bluesky) {
		@apply bg-sky-500 text-white hover:bg-sky-600 focus:ring-sky-500;
	}

	:global(.share-btn.copy) {
		@apply bg-gray-400 text-white hover:bg-gray-500 focus:ring-gray-400;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 640px) {
		.share-buttons-grid {
			@apply grid-cols-4 gap-1;
		}

		:global(.share-btn) {
			@apply h-8 w-8;
		}
	}
</style>
