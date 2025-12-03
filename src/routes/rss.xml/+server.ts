import RSS from 'rss';
import { getCompletedGames } from '$lib/server/services/gameService';
import type { RequestHandler } from './$types';
import { PUBLIC_SITE_TITLE } from '$env/static/public';

export const GET: RequestHandler = async ({ url }) => {
	const games = await getCompletedGames({ limit: 50 });

	const feed = new RSS({
		title: `${PUBLIC_SITE_TITLE} Games RSS Feed`,
		description: `The latest completed games from ${PUBLIC_SITE_TITLE}`,
		feed_url: `${url.origin}/rss.xml`,
		site_url: url.origin,
		image_url: `${url.origin}/favicon-96x96.png`,
		language: 'en',
		pubDate: new Date(),
		ttl: 60
	});

	for (const game of games) {
		const firstDrawing = game.turns.find((turn) => turn.isDrawing);
		const firstWriting = game.turns.find((turn) => !turn.isDrawing);

		let description = 'A completed game.';
		if (firstDrawing && firstWriting) {
			description = `<img src="${url.origin}${firstDrawing.content}" alt="Drawing"><p>${firstWriting.content}</p>`;
		} else if (firstDrawing) {
			description = `<img src="${url.origin}${firstDrawing.content}" alt="Drawing">`;
		} else if (firstWriting) {
			description = `<p>${firstWriting.content}</p>`;
		}

		feed.item({
			title: `New completed game!`,
			description: description,
			url: `${url.origin}/g/${game.id}`,
			guid: game.id,
			date: game.completedAt || new Date()
		});
	}

	return new Response(feed.xml(), {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600' // Cache for 1 hour
		}
	});
};
