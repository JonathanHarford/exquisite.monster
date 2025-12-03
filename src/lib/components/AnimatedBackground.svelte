<script lang="ts">
	import { onMount } from 'svelte';

	// Configuration constants
	const characters = [...'🍽️🐈️🫵💩👹']; // Use spread operator for proper Unicode splitting
	const characterColors = [
		'rgb(45 212 191)', // primary-400 - vibrant teal
		'rgb(251 146 60)', // success-400 - warm orange
		'rgb(250 204 21)', // warning-400 - sunny yellow
		'rgb(244 114 182)', // danger-400 - playful magenta
		'rgb(94 234 212)' // primary-300 - lighter teal
	];
	const characterDensity = 0.000003; // emojis per pixel
	const characterSize = 40;
	const maxVelocity = 0.25; // pixels per frame
	const maxRotationSpeed = 1; // degrees per frame

	let container: HTMLDivElement;
	let animationId: number;
	let resizeTimeout: ReturnType<typeof setTimeout>;
	let characters_data: Array<{
		x: number;
		y: number;
		vx: number;
		vy: number;
		char: string;
		color: string;
		size: number;
		rotation: number;
		rotationSpeed: number;
	}> = $state([]);

	function initializeCharacters() {
		if (!container) return;

		const area = window.innerWidth * window.innerHeight;
		const count = Math.floor(area * characterDensity);

		characters_data = [];
		for (let i = 0; i < count; i++) {
			characters_data.push({
				x: Math.random() * window.innerWidth,
				y: Math.random() * window.innerHeight,
				vx: (Math.random() - 0.5) * maxVelocity * 2,
				vy: (Math.random() - 0.5) * maxVelocity * 2,
				char: characters[Math.floor(Math.random() * characters.length)],
				color: characterColors[Math.floor(Math.random() * characterColors.length)],
				size: characterSize,
				rotation: Math.random() * 360,
				rotationSpeed: (Math.random() - 0.5) * maxRotationSpeed
			});
		}
	}

	function updateCharacters() {
		for (const char of characters_data) {
			// Update position
			char.x += char.vx;
			char.y += char.vy;

			// Update rotation
			char.rotation += char.rotationSpeed;

			// Wrap around edges
			if (char.x > window.innerWidth) char.x = -char.size;
			if (char.x < -char.size) char.x = window.innerWidth;
			if (char.y > window.innerHeight) char.y = -char.size;
			if (char.y < -char.size) char.y = window.innerHeight;
		}
	}

	function animate() {
		updateCharacters();
		animationId = requestAnimationFrame(animate);
	}

	function handleResize() {
		// Clear existing timeout
		if (resizeTimeout) {
			clearTimeout(resizeTimeout);
		}

		// Set new timeout for 3 seconds
		resizeTimeout = setTimeout(() => {
			initializeCharacters();
		}, 3000);
	}

	onMount(() => {
		initializeCharacters();
		animate();

		window.addEventListener('resize', handleResize);

		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
			if (resizeTimeout) {
				clearTimeout(resizeTimeout);
			}
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div bind:this={container} id="bg-container">
	<svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
		{#each characters_data as char}
			<text
				x={char.x}
				y={char.y}
				font-size="{char.size}px"
				font-family="Arial, sans-serif"
				fill={char.color}
				dominant-baseline="middle"
				text-anchor="middle"
				transform="rotate({char.rotation} {char.x} {char.y})"
				opacity="0.8"
			>
				{char.char}
			</text>
		{/each}
	</svg>
</div>

<style lang="postcss">
	#bg-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
		pointer-events: none;
		overflow: hidden;
		@apply bg-gradient-to-br from-primary-200 via-warning-200 to-success-300;
	}
</style>
