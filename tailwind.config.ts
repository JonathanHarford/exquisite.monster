import type { Config } from 'tailwindcss';
import flowbitePlugin from 'flowbite/plugin';

export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'
	],
	darkMode: 'selector',
	theme: {
		extend: {
			colors: {
				// Primary brand colors - playful teal/turquoise theme
				primary: {
					50: '#f0fdfa',
					100: '#ccfbf1',
					200: '#99f6e4',
					300: '#5eead4',
					400: '#2dd4bf',
					500: '#14b8a6', // Main brand teal
					600: '#0d9488',
					700: '#0f766e',
					800: '#115e59',
					900: '#134e4a'
				},
				// Success/CTA colors - warm coral/orange
				success: {
					50: '#fff7ed',
					100: '#ffedd5',
					200: '#fed7aa',
					300: '#fdba74',
					400: '#fb923c',
					500: '#f97316', // Main CTA orange
					600: '#ea580c',
					700: '#c2410c',
					800: '#9a3412',
					900: '#7c2d12'
				},
				// Warning/Alert colors - sunny yellow
				warning: {
					50: '#fefce8',
					100: '#fef9c3',
					200: '#fef08a',
					300: '#fde047',
					400: '#facc15',
					500: '#eab308', // Main warning yellow
					600: '#ca8a04',
					700: '#a16207',
					800: '#854d0e',
					900: '#713f12'
				},
				// Error/Danger colors - playful magenta
				danger: {
					50: '#fdf2f8',
					100: '#fce7f3',
					200: '#fbcfe8',
					300: '#f9a8d4',
					400: '#f472b6',
					500: '#ec4899', // Main error magenta
					600: '#db2777',
					700: '#be185d',
					800: '#9d174d',
					900: '#831843'
				},
				// Neutral colors - warm cream/beige instead of gray
				neutral: {
					50: '#fefdfb',
					100: '#faf8f3',
					200: '#f2ede3',
					300: '#e6ddc8',
					400: '#d4c4a8',
					500: '#c2b092', // Main neutral - warm beige
					600: '#a89176',
					700: '#8a7460',
					800: '#6b5a4a',
					900: '#4a3f35'
				}
			}
		}
	},
	plugins: [flowbitePlugin]
} as Config;
