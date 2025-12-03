<script lang="ts">
	import { PUBLIC_SITE_TITLE } from '$env/static/public';
	import { page } from '$app/state';

	interface Props {
		title?: string;
		description?: string;
		keywords?: string;
		image?: string;
		type?: 'website' | 'article' | 'profile';
		noIndex?: boolean;
	}

	const {
		title = PUBLIC_SITE_TITLE,
		description = `${PUBLIC_SITE_TITLE} is an adaptation of the objectively best party game of writing and drawing, Eat Poop You Cat.`,
		keywords = 'drawing game, writing game, telephone game, eat poop you cat, telestrations, online game, party game, exquisite corpse',
		image = `${page.url.origin}/web-app-manifest-512x512.png`,
		type = 'website',
		noIndex = false
	}: Props = $props();

	// Create full title - if a custom title is provided, append site name
	const fullTitle = $derived(title === PUBLIC_SITE_TITLE ? title : `${title} - ${PUBLIC_SITE_TITLE}`);
	// Automatically use the current page URL
	const fullUrl = $derived(`${page.url.origin}${page.url.pathname}`);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<meta name="keywords" content={keywords} />

	{#if noIndex}
		<meta name="robots" content="noindex, nofollow" />
	{:else}
		<meta name="robots" content="index, follow" />
	{/if}

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content={type} />
	<meta property="og:url" content={fullUrl} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:site_name" content={PUBLIC_SITE_TITLE} />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content={fullUrl} />
	<meta property="twitter:title" content={fullTitle} />
	<meta property="twitter:description" content={description} />
	<meta property="twitter:image" content={image} />

	<!-- Additional meta tags -->
	<meta name="theme-color" content="#936090" />
	<link rel="canonical" href={fullUrl} />
</svelte:head>
