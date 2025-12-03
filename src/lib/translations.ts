import i18n from 'sveltekit-i18n';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Type for nested translation structure
type TranslationValue = string | { [key: string]: TranslationValue };
type TranslationObject = { [key: string]: TranslationValue };

// Helper to fetch and format translations for a specific locale
const getTranslationsForLocale = async (lang: string): Promise<TranslationObject> => {
	try {
		const copyTexts = await prisma.copyText.findMany({
			where: { lang }
		});
		const translations = copyTexts.reduce((acc: TranslationObject, { key, value }) => {
			const keys = key.split('.');
			let current: TranslationObject = acc;
			keys.forEach((k, index) => {
				if (index === keys.length - 1) {
					current[k] = value;
				} else {
					if (!current[k]) {
						current[k] = {};
					}
					current = current[k] as TranslationObject;
				}
			});
			return acc;
		}, {} as TranslationObject);
		console.log(`Translations loaded for ${lang}:`, JSON.stringify(translations, null, 2));
		return translations;
	} catch (error) {
		console.error(`Failed to load translations for ${lang}:`, error);
		return {}; // Return empty object on error
	}
};

/** @type {import('sveltekit-i18n').Config} */
const config = {
	log: {
		level: 'warn' as const // Use 'warn' instead of 'debug' and ensure it's a const assertion
	},
	loaders: [
		{
			locale: 'en',
			key: 'common', // Using a single key 'common' to load all translations for 'en'
			loader: async () => await getTranslationsForLocale('en')
			// routes: ['/'] // Optional: if you want to specify routes for this loader
		}
		// Example for another language:
		// {
		//   locale: 'es',
		//   key: 'common',
		//   loader: async () => await getTranslationsForLocale('es'),
		// },
	]
};

export const { t, locale, locales, loading, loadTranslations } = new i18n(config);

// Optional: If you need to dynamically add translations after initial load,
// sveltekit-i18n might have utilities for this, or you might need to manage it
// by updating the store or re-calling loadTranslations if the locale changes.
// For now, the above setup handles initial load based on the determined locale.
