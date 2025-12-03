<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { Footer, FooterCopyright, FooterLink, FooterLinkGroup } from 'flowbite-svelte';
	import { SignedIn } from 'svelte-clerk';

	const PUBLIC_DISCORD_INVITE_ID = env.PUBLIC_DISCORD_INVITE_ID;
	const PUBLIC_OWNER_URL = env.PUBLIC_OWNER_URL;
	const PUBLIC_OWNER_NAME = env.PUBLIC_OWNER_NAME;
</script>

<Footer
	class="z-20 mt-auto flex flex-col justify-between bg-gradient-to-r from-primary-100 to-warning-100 pb-16 text-sm md:flex-row md:pb-0"
>
	<FooterLinkGroup ulClass="flex flex-wrap justify-start gap-4 px-4">
		<FooterLink href="/info/about">About</FooterLink>
		<FooterLink href="/info/privacy">Privacy</FooterLink>
		<SignedIn>
			<FooterLink href="/info/contact">Contact</FooterLink>
		</SignedIn>
		{#if PUBLIC_DISCORD_INVITE_ID}
			<FooterLink
				href={`https://discord.gg/${PUBLIC_DISCORD_INVITE_ID}`}
				target="_blank"
				rel="noopener noreferrer"
				classA="flex items-center"
			>
				<iconify-icon icon="ic:baseline-discord"></iconify-icon>
				Discord</FooterLink
			>
		{/if}
		<FooterLink href="/rss.xml" target="_blank" classA="flex items-center">
			<iconify-icon icon="mdi:rss"></iconify-icon>
			RSS
		</FooterLink>
		<!-- <FooterIcon href={`https://liberapay.com/${PUBLIC_LIBERAPAY_ID}/donate`}>
			<img src="https://img.shields.io/liberapay/receives/${PUBLIC_LIBERAPAY_ID}.svg?logo=liberapay">
		</FooterIcon> -->
	</FooterLinkGroup>
	{#if PUBLIC_OWNER_NAME && PUBLIC_OWNER_URL}
		<div class="flex flex-row justify-between">
			<FooterCopyright href={PUBLIC_OWNER_URL} by={PUBLIC_OWNER_NAME} />
		</div>
	{/if}
</Footer>

<style lang="postcss">
	:global(footer) {
		box-shadow: 0 -10px 10px 0 rgb(20 184 166 / 15%);
	}
</style>
