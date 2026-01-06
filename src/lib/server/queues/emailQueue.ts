import { addJob } from '$lib/server/services/queueService';
import { EmailService } from '$lib/server/services/emailService.js';
import { logger } from '$lib/server/logger.js';
import { prisma } from '$lib/server/prisma';
import { getMessageTemplate, type MessageData } from '$lib/server/messaging';
import { clerkClient } from 'svelte-clerk/server';

// Job data interfaces
export interface GeneralNotificationJobData {
	type: 'general-notification';
	notificationId: string;
	notificationType: string;
	userId: string;
	templateData: MessageData;
}

export interface FlagSubmittedJobData {
	type: 'flag-submitted';
	flagId: string;
	turnId: string;
	gameId: string;
	reason: 'spam' | 'offensive' | 'other';
	explanation?: string;
	flaggerUsername: string;
	turnCreatorUsername: string;
}

export interface FlagConfirmedJobData {
	type: 'flag-confirmed';
	flagId: string;
	turnId: string;
	gameId: string;
	reason: 'spam' | 'offensive' | 'other';
	explanation?: string;
	flaggerUsername: string;
	turnCreatorUsername: string;
	adminUsername: string;
	turnCreatorEmail: string;
}

export interface FlagRejectedJobData {
	type: 'flag-rejected';
	flagId: string;
	turnId: string;
	gameId: string;
	reason: 'spam' | 'offensive' | 'other';
	explanation?: string;
	flaggerUsername: string;
	turnCreatorUsername: string;
	adminUsername: string;
	flaggerEmail: string;
}

export type EmailJobData =
	| FlagSubmittedJobData
	| FlagConfirmedJobData
	| FlagRejectedJobData
	| GeneralNotificationJobData;

// Email worker processor
export const processEmailJob = async (data: EmailJobData): Promise<void> => {
	try {
		switch (data.type) {
			case 'general-notification': {
				logger.info(`Processing email job: ${data.type} for notification ${data.notificationId}`);

				if (!EmailService.isEnabled()) {
					logger.debug('Email service not enabled, skipping notification email', {
						notificationId: data.notificationId,
						type: data.notificationType
					});
					return;
				}

				const [user, player] = await Promise.all([
					clerkClient.users.getUser(data.userId),
					prisma.player.findUnique({
						where: { id: data.userId },
						select: { username: true }
					})
				]);

				const userEmail = user.emailAddresses?.[0]?.emailAddress;

				if (!userEmail) {
					logger.warn('No email address found for user, skipping notification email', {
						userId: data.userId,
						notificationId: data.notificationId
					});
					return;
				}

				const templateKey = `notification.${data.notificationType}`;
				const template = await getMessageTemplate(templateKey, data.templateData);

				if (!template || !template.subject) {
					logger.warn('No email template or subject found for notification type', {
						templateKey,
						notificationId: data.notificationId
					});
					return;
				}

				await EmailService.sendNotificationEmail({
					to: userEmail,
					subject: template.subject,
					text: template.body,
					html: template.htmlBody,
					toName: player?.username
				});

				logger.info(`Email job completed: ${data.type} for notification ${data.notificationId}`);
				break;
			}

			case 'flag-submitted':
				logger.info(`Processing email job: ${data.type} for flag ${data.flagId}`);
				await EmailService.sendFlagSubmittedNotification({
					flagId: data.flagId,
					turnId: data.turnId,
					gameId: data.gameId,
					reason: data.reason,
					explanation: data.explanation,
					flaggerUsername: data.flaggerUsername,
					turnCreatorUsername: data.turnCreatorUsername
				});
				logger.info(`Email job completed: ${data.type} for flag ${data.flagId}`);
				break;

			case 'flag-confirmed':
				logger.info(`Processing email job: ${data.type} for flag ${data.flagId}`);
				await EmailService.sendFlagConfirmedNotification(
					{
						flagId: data.flagId,
						turnId: data.turnId,
						gameId: data.gameId,
						reason: data.reason,
						explanation: data.explanation,
						flaggerUsername: data.flaggerUsername,
						turnCreatorUsername: data.turnCreatorUsername,
						adminUsername: data.adminUsername
					},
					data.turnCreatorEmail,
					data.turnCreatorUsername
				);
				logger.info(`Email job completed: ${data.type} for flag ${data.flagId}`);
				break;

			case 'flag-rejected':
				logger.info(`Processing email job: ${data.type} for flag ${data.flagId}`);
				await EmailService.sendFlagRejectedNotification(
					{
						flagId: data.flagId,
						turnId: data.turnId,
						gameId: data.gameId,
						reason: data.reason,
						explanation: data.explanation,
						flaggerUsername: data.flaggerUsername,
						turnCreatorUsername: data.turnCreatorUsername,
						adminUsername: data.adminUsername
					},
					data.flaggerEmail,
					data.flaggerUsername
				);
				logger.info(`Email job completed: ${data.type} for flag ${data.flagId}`);
				break;

			default:
				throw new Error(`Unknown email job type: ${(data as { type: string }).type}`);
		}
	} catch (error) {
		const jobId = 'flagId' in data ? data.flagId : 'notificationId' in data ? data.notificationId : 'unknown';
		logger.error(`Email job failed: ${data.type} (${jobId})`, error);
		throw error;
	}
};

// Initialization (No-op)
export const initializeEmailQueue = async (): Promise<void> => {
	// No-op
};

// Queue helper functions
export const queueFlagSubmittedEmail = async (
	data: Omit<FlagSubmittedJobData, 'type'>
): Promise<void> => {
	await addJob(
		'email',
		{ type: 'flag-submitted', ...data },
		{
			jobId: `flag-submitted-${data.flagId}`
		}
	);
};

export const queueGeneralNotification = async (
	data: Omit<GeneralNotificationJobData, 'type'>
): Promise<void> => {
	await addJob(
		'email',
		{ type: 'general-notification', ...data },
		{
			jobId: `notification-${data.notificationId}`
		}
	);
};

export const queueFlagConfirmedEmail = async (
	data: Omit<FlagConfirmedJobData, 'type'>
): Promise<void> => {
	await addJob(
		'email',
		{ type: 'flag-confirmed', ...data },
		{
			jobId: `flag-confirmed-${data.flagId}`
		}
	);
};

export const queueFlagRejectedEmail = async (
	data: Omit<FlagRejectedJobData, 'type'>
): Promise<void> => {
	await addJob(
		'email',
		{ type: 'flag-rejected', ...data },
		{
			jobId: `flag-rejected-${data.flagId}`
		}
	);
};
