<script lang="ts">
	import { Howl } from 'howler';
	import { onDestroy } from 'svelte';
	import { appState } from '$lib/appstate.svelte';

	type Tracks = Record<
		string,
		{
			ids: number[];
			sound: Howl;
		}
	>;
	const tracks = $state<Tracks>({});

	// Track the last audio that was played to avoid replaying the same audio
	let lastPlayedAudio = $state<string | undefined>(undefined);

	$effect(() => {
		const { audio } = appState;

		// Only play if there's audio and it's different from the last played
		if (audio && audio !== lastPlayedAudio) {
			if (!tracks[audio]) {
				tracks[audio] = {
					ids: [],
					sound: new Howl({
						src: [audio]
					})
				};
			}
			tracks[audio].ids.push(tracks[audio].sound.play());
			lastPlayedAudio = audio;

			// Clear the audio after playing, but use a microtask to avoid infinite loop
			queueMicrotask(() => {
				appState.audio = undefined;
			});
		}
	});

	const killAll = () => {
		Object.values(tracks).forEach((track) => {
			track.ids.forEach((id) => {
				track.sound.stop(id);
			});
			track.ids.length = 0;
		});
	};

	// Stop sound when component is destroyed or timer becomes undefined
	onDestroy(() => {
		killAll();
	});
</script>
