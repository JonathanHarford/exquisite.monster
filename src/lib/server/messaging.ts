import { logger } from '$lib/server/logger';
import { PUBLIC_SITE_TITLE, PUBLIC_BASE_URL } from '$env/static/public';
import { t } from '$lib/translations'; // Import t from sveltekit-i18n
import { get } from 'svelte/store'; // To get store value non-reactively
import { prisma } from '$lib/server/prisma';

export interface MessageTemplate {
	subject?: string;
	title: string;
	body: string;
	htmlBody?: string;
}

export interface MessageData {
	[key: string]: string | number | boolean | Date | null | undefined;
}

/**
 * Fetch message templates from database
 * @param keys Array of template keys
 * @param lang Language code (defaults to 'en')
 * @returns Record of MessageTemplate objects
 */
export const fetchMessageTemplates = async (
	keys: string[],
	lang: string = 'en'
): Promise<Record<string, MessageTemplate>> => {
	const templates: Record<string, MessageTemplate> = {};

	for (const key of keys) {
		const parts = await prisma.copyText.findMany({
			where: {
				key: {
					startsWith: `${key}.`
				},
				lang
			}
		});

		if (parts.length === 0) {
			continue; // Skip if no parts found
		}

		const template: Partial<MessageTemplate> = {};

		for (const part of parts) {
			const partKey = part.key.replace(`${key}.`, '');
			switch (partKey) {
				case 'subject':
					template.subject = part.value;
					break;
				case 'title':
					template.title = part.value;
					break;
				case 'body':
					template.body = part.value;
					break;
				case 'html_body':
					template.htmlBody = part.value;
					break;
			}
		}

		// Only include template if it has required parts
		if (template.title && template.body) {
			templates[key] = template as MessageTemplate;
		}
	}

	return templates;
};

/**
 * Interpolate template string with data
 * @param template Template string with {{variable}} or ${variable} placeholders
 * @param data Data for interpolation
 * @returns Interpolated string
 */
export const interpolateTemplate = (template: string, data: MessageData): string => {
	const fullData = {
		SITE_TITLE: PUBLIC_SITE_TITLE,
		BASE_URL: PUBLIC_BASE_URL,
		...data
	};

	// Handle both {{variable}} and ${variable} syntax
	return template
		.replace(/\{\{(\w+)\}\}/g, (match, key) => {
			const value = fullData[key as keyof typeof fullData];
			if (value === null || value === undefined) {
				return match; // Return original placeholder if value is null/undefined
			}
			return String(value);
		})
		.replace(/\$\{(\w+)\}/g, (match, key) => {
			const value = fullData[key as keyof typeof fullData];
			if (value === null || value === undefined) {
				return match; // Return original placeholder if value is null/undefined
			}
			return String(value);
		});
};

/**
 * Processes a message template with data interpolation
 * Support both old signature (template object) and new signature (baseKey string)
 */
export function processMessageTemplate(
	template: MessageTemplate,
	data: MessageData
): MessageTemplate;
export function processMessageTemplate(baseKey: string, data: MessageData): MessageTemplate;
export function processMessageTemplate(
	templateOrBaseKey: MessageTemplate | string,
	data: MessageData
): MessageTemplate {
	const fullData = {
		SITE_TITLE: PUBLIC_SITE_TITLE,
		BASE_URL: PUBLIC_BASE_URL,
		...data
	};

	// Handle old signature (template object)
	if (typeof templateOrBaseKey === 'object') {
		const template = templateOrBaseKey;
		return {
			subject: template.subject ? interpolateTemplate(template.subject, fullData) : undefined,
			title: interpolateTemplate(template.title, fullData),
			body: interpolateTemplate(template.body, fullData),
			htmlBody: template.htmlBody ? interpolateTemplate(template.htmlBody, fullData) : undefined
		};
	}

	// Handle new signature (baseKey string) - i18n version
	const baseKey = templateOrBaseKey;

	// Helper to safely get a translation, returning undefined if the key isn't found
	// or if the translation is empty, which can be common for optional parts like subject/htmlBody.
	const translate = (partKey: string): string | undefined => {
		// Pass fullData directly as the second argument for interpolation values
		const translation = get(t)(partKey, fullData as Record<string, unknown>);
		// Check if translation is missing (key itself is returned) or empty
		if (translation === partKey || translation === '') {
			// Log if a required part like title or body is missing
			if (partKey.endsWith('.title') || partKey.endsWith('.body')) {
				logger.warn(`Missing or empty translation for required part: ${partKey}`);
			}
			return undefined;
		}
		return translation;
	};

	const subject = translate(`${baseKey}.subject`);
	const title = translate(`${baseKey}.title`);
	const body = translate(`${baseKey}.body`);
	const htmlBody = translate(`${baseKey}.html_body`);

	// Title and body are considered essential for a valid template.
	if (!title || !body) {
		logger.error(`Essential template parts (title or body) missing for base key: ${baseKey}`);
		// Return a dummy/error template or throw, depending on desired error handling.
		// For now, returning a template that indicates an error.
		return {
			title: `Error: Template ${baseKey} title missing`,
			body: `Error: Template ${baseKey} body missing`
		};
	}

	return {
		subject,
		title,
		body,
		htmlBody
	};
}

/**
 * Gets a processed message template by key
 * @param key Template key
 * @param data Data for interpolation
 * @param lang Language code (defaults to 'en')
 * @returns Processed MessageTemplate or null if not found
 */
export const getMessageTemplate = async (
	key: string,
	data: MessageData = {},
	lang: string = 'en'
): Promise<MessageTemplate | null> => {
	const templates = await fetchMessageTemplates([key], lang);
	const template = templates[key];

	if (!template) {
		return null;
	}

	return processMessageTemplate(template, data);
};

/**
 * Gets multiple processed message templates by keys
 * @param keys Array of template keys
 * @param data Data for interpolation
 * @param lang Language code (defaults to 'en')
 * @returns Record of processed MessageTemplate objects
 */
export const getMessageTemplates = async (
	keys: string[],
	data: MessageData = {},
	lang: string = 'en'
): Promise<Record<string, MessageTemplate>> => {
	const templates = await fetchMessageTemplates(keys, lang);
	const processedTemplates: Record<string, MessageTemplate> = {};

	for (const [key, template] of Object.entries(templates)) {
		processedTemplates[key] = processMessageTemplate(template, data);
	}

	return processedTemplates;
};
