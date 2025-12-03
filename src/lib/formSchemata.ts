import { z } from 'zod/v4';
import { DAYS, SECONDS, parseDuration, formatDuration } from './datetime';
import { FILE_UPLOAD, ACCEPTED_FILE_TYPES, formatFileSize } from './constants';
import type { GameConfig } from '$lib/types/domain';

const durationSchema = z.string().refine(
	(val) => {
		try {
			const ms = parseDuration(val);
			return ms >= 5 * SECONDS && ms <= 7 * DAYS;
		} catch {
			return false;
		}
	},
	{
		message:
			'Invalid duration format. Use format like "1h", "30m", "2h30m". Must be between 5 seconds and 7 days.'
	}
);

export const gameConfigSchema = z.object({
	maxTurns: z.number().int().positive().nullable(),
	minTurns: z.number().int().positive(),
	writingTimeout: durationSchema,
	drawingTimeout: durationSchema,
	gameTimeout: durationSchema
});

export const formToDb = (
	gameConfigForm: z.infer<typeof gameConfigSchema>
): GameConfig => {
	return {
		maxTurns: gameConfigForm.maxTurns,
		minTurns: gameConfigForm.minTurns,
		writingTimeout: gameConfigForm.writingTimeout,
		drawingTimeout: gameConfigForm.drawingTimeout,
		gameTimeout: gameConfigForm.gameTimeout,
		isLewd: false // Default value for form conversion
	};
};

export const dbToForm = (gameConfig: GameConfig): z.infer<typeof gameConfigSchema> => {
	const formatTimeout = (timeout: string | number): string => {
		if (typeof timeout === 'string') {
			return formatDuration(parseDuration(timeout), false);
		}
		return formatDuration(timeout, false);
	};

	return {
		maxTurns: gameConfig.maxTurns,
		minTurns: gameConfig.minTurns,
		writingTimeout: formatTimeout(gameConfig.writingTimeout),
		drawingTimeout: formatTimeout(gameConfig.drawingTimeout),
		gameTimeout: formatTimeout(gameConfig.gameTimeout)
	};
};

export const flagTurnSchema = z.object({
	turnId: z.string(),
	reason: z.enum(['spam', 'offensive', 'other']),
	explanation: z.string().optional()
});

export const playerProfileSchema = z.object({
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters long.')
		.max(50, 'Username must be at most 50 characters long.'),
	imageUrl: z.url().or(z.literal('')).default(''),
	aboutMe: z.string().max(2500).default(''),
	websiteUrl: z.url().or(z.literal('')).default(''),
	birthday: z.coerce.date().nullable().optional(),
	hideLewdContent: z.boolean().default(true)
});

export const favoriteSchema = z.object({
	id: z.string().min(1, 'ID is required'),
	action: z.enum(['favorite', 'unfavorite'])
});

export const markAllAsReadSchema = z.object({
	// No fields needed - this is just for the action
});

export const markAsReadSchema = z.object({
	notificationId: z.string().min(1, 'Notification ID is required')
});

export const contactFormSchema = z.object({
	name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
	email: z.email('Please enter a valid email address'),
	subject: z
		.string()
		.min(1, 'Subject is required')
		.max(200, 'Subject must be at most 200 characters'),
	message: z
		.string()
		.min(10, 'Message must be at least 10 characters')
		.max(2000, 'Message must be at most 2000 characters')
});

export type PlayerProfileSchema = typeof playerProfileSchema;
export type FavoriteSchema = typeof favoriteSchema;
export type MarkAllAsReadSchema = typeof markAllAsReadSchema;
export type MarkAsReadSchema = typeof markAsReadSchema;
export type ContactFormSchema = typeof contactFormSchema;

export const drawingUploadSchema = z.object({
	file: z
		.instanceof(File, { message: 'Please upload a file.' })
		.refine(
			(file) => file.size <= FILE_UPLOAD.MAX_TURN_FILE_SIZE,
			`Max file size is ${formatFileSize(FILE_UPLOAD.MAX_TURN_FILE_SIZE)}.`
		)
		.refine(
			(file) => (ACCEPTED_FILE_TYPES as readonly string[]).includes(file.type),
			'.jpg, .jpeg, .png, .webp, .gif and .pdf files are accepted.'
		)
});

export type DrawingUploadSchema = typeof drawingUploadSchema;

export const partyCreationSchema = z.object({
	title: z
		.string()
		.min(3, 'Party title must be at least 3 characters')
		.max(100, 'Party title must be no more than 100 characters'),
	turnPassingAlgorithm: z.enum(['round-robin', 'algorithmic']),
	allowPlayerInvites: z.boolean().default(false)
});

export type PartyCreationSchema = typeof partyCreationSchema;
