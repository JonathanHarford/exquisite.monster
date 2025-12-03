export async function GET({ request }) {
	const url = new URL(request.url);
	const origin = url.origin;

	return new Response(
		`User-agent: *
Allow: /
Allow: /g
Allow: /g/*
Allow: /info/*
Allow: /p/*

Disallow: /account
Disallow: /account/*
Disallow: /admin
Disallow: /admin/*
Disallow: /play
Disallow: /play/*
Disallow: /api/*

Sitemap: ${origin}/sitemap.xml`,
		{
			headers: {
				'Content-Type': 'text/plain'
			}
		}
	);
}
