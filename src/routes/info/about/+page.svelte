<script lang="ts">
	import { PUBLIC_SITE_TITLE } from '$env/static/public';
	import GameView from '$lib/components/GameView.svelte';
	import type { PageProps } from './$types';
	import SEO from '$lib/components/SEO.svelte';
	import { HOURS } from '$lib/datetime';
	const { data }: PageProps = $props();

	const presentation = $derived.by(() => {
		if (data.self) {
			const accountAge = Date.now() - data.self.createdAt.getTime();
			if (accountAge > 24 * HOURS) {
				return [];
			}
		}
		return [
			{
				idx: 0,
				duration: 3000,
				markdown: 'The *first player* comes up with a **sentence**.'
			},
			{
				idx: 1,
				duration: 3000,
				markdown: 'The *second player* **draws a picture** of the sentence.'
			},
			{
				idx: 2,
				duration: 3000,
				markdown: 'The *third player* is shown the picture and writes a **sentence describing it**.'
			},
			{
				idx: 3,
				duration: 3000,
				markdown: '*(...and so on...)*'
			},
			{
				idx: -1,
				duration: 3000,
				markdown: 'After all players have contributed, the full chain of turns is revealed.'
			}
		];
	});
</script>

<SEO title="How to Play" description="Learn how to play {PUBLIC_SITE_TITLE}" />

<h2>How to Play</h2>
<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
	<div class="col-span-2 flex flex-col items-center gap-4">
		<GameView
			game={data.games[0]}
			{presentation}
			showDates={false}
			showCompletedDate={false}
			showComments={false}
		/>

	</div>

	<div class="copy-text flex flex-col items-start gap-4">
		<section>
			<h3>The Game</h3>
			<p>I bet you've played some form of this before (maybe with a different name).</p>
			<p>
				The <em>first player</em> comes up with a <b>sentence</b>. The
				<em>second player</em> <b>draws a picture</b> of the sentence. The
				<em>third player</em>
				writes a <b>sentence describing the picture</b>. (Etc. etc.)
			</p>
			<p>After all players have contributed, the full sequence is revealed.</p>
		</section>
		<section>
			<h3>So This Is Pretty Much The Same As...?</h3>
			<p><em>If I have seen further than others, it is by standing on the shoulders of giants.</em></p>
			<p>
				There are already a number of <em>great</em> ways to play a single turn in a game of Eat Poop You Cat with
				strangers. {PUBLIC_SITE_TITLE} exists because:
			</p>

			<h4>Upload Option</h4>
			<p>
				Not everybody wants to draw with their mouse or finger &mdash; use whatever tool you feel like to make the art!
			</p>

			<h4>Party Mode</h4>
			<p>
				The <em>funnest</em> way to play <b>Eat Poop You Cat</b> is at a party with your
				friends, and each player writes their sentence on a piece of paper and then they all get passed around. 
				<a href="/s/new">Party Mode</a> captures that experience!
			</p>
		</section>
		<a href="/play" class="btn btn-primary mx-auto">I'm sold. Let's do this.</a>
	</div>
</div>

<style>
	h3, h4 {
		text-align: center;
	}
</style>
