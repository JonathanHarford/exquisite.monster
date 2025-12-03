import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const baseUrl = url.origin;
	const currentDate = new Date().toISOString().split('T')[0];

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>
		<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
			<url>
				<loc>${baseUrl}/</loc>
				<lastmod>${currentDate}</lastmod>
				<changefreq>daily</changefreq>
				<priority>1.0</priority>
			</url>
			<url>
				<loc>${baseUrl}/g</loc>
				<lastmod>${currentDate}</lastmod>
				<changefreq>daily</changefreq>
				<priority>0.9</priority>
			</url>
			<url>
				<loc>${baseUrl}/info/about</loc>
				<lastmod>${currentDate}</lastmod>
				<changefreq>monthly</changefreq>
				<priority>0.8</priority>
			</url>
			<url>
				<loc>${baseUrl}/info/contact</loc>
				<lastmod>${currentDate}</lastmod>
				<changefreq>monthly</changefreq>
				<priority>0.6</priority>
			</url>
			<url>
				<loc>${baseUrl}/info/privacy</loc>
				<lastmod>${currentDate}</lastmod>
				<changefreq>monthly</changefreq>
				<priority>0.5</priority>
			</url>
		</urlset>`.trim(),
		{
			headers: {
				'Content-Type': 'application/xml'
			}
		}
	);
};
