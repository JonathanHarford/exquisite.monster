import { QueueManager, createQueueOptions, createWorkerOptions } from './config.js';
import { EmailService } from '$lib/server/services/emailService.js';
import { logger } from '$lib/server/logger.js';
import { queueMonitor } from './monitor.js';
import type { Job } from 'bullmq';
import { prisma } from '$lib/server/prisma';
import { getMessageTemplate, type MessageData } from '$lib/server/messaging';
import { clerkClient } from 'svelte-clerk/server';

// Job data interfaces
interface GeneralNotificationJobData {
	type: 'general-notification';
	notificationId: string;
	notificationType: string;
	userId: string;
	templateData: MessageData;
}

interface FlagSubmittedJobData {
	type: 'flag-submitted';
	flagId: string;
	turnId: string;
	gameId: string;
	reason: 'spam' | 'offensive' | 'other';
	explanation?: string;
	flaggerUsername: string;
	turnCreatorUsername: string;
}

interface FlagConfirmedJobData {
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

interface FlagRejectedJobData {
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

type EmailJobData =
	| FlagSubmittedJobData
	| FlagConfirmedJobData
	| FlagRejectedJobData
	| GeneralNotificationJobData;

// Email worker processor
const processEmailJob = async (job: Job): Promise<void> => {
	const data: EmailJobData = job.data;

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

// Create email queue manager with custom options
const emailQueueManager = new QueueManager(
	'email',
	createQueueOptions({
		defaultJobOptions: {
			removeOnComplete: true,
			removeOnFail: true,
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 2000
			}
		}
	}),
	createWorkerOptions({
		concurrency: 2, // Lower concurrency for email sending
		limiter: {
			max: 10, // Max 10 emails per second
			duration: 1000
		}
	}),
	processEmailJob
);

// Export initialization function to be called at app startup
export const initializeEmailQueue = async (): Promise<void> => {
	await emailQueueManager.initialize();

	// Register with monitoring system
	if (emailQueueManager.isReady) {
		queueMonitor.registerQueue('email', emailQueueManager);
	}
};

// Queue helper functions
export const queueFlagSubmittedEmail = async (
	data: Omit<FlagSubmittedJobData, 'type'>
): Promise<void> => {
	await emailQueueManager.addJob(
		'flag-submitted',
		{ type: 'flag-submitted', ...data },
		{
			priority: 1, // High priority for admin notifications
			jobId: `flag-submitted-${data.flagId}`
		}
	);
};

export const queueGeneralNotification = async (
	data: Omit<GeneralNotificationJobData, 'type'>
): Promise<void> => {
	await emailQueueManager.addJob(
		'general-notification',
		{ type: 'general-notification', ...data },
		{
			priority: 3, // Low priority for general notifications
			jobId: `notification-${data.notificationId}`
		}
	);
};

export const queueFlagConfirmedEmail = async (
	data: Omit<FlagConfirmedJobData, 'type'>
): Promise<void> => {
	await emailQueueManager.addJob(
		'flag-confirmed',
		{ type: 'flag-confirmed', ...data },
		{
			priority: 2, // Medium priority for user notifications
			jobId: `flag-confirmed-${data.flagId}`
		}
	);
};

export const queueFlagRejectedEmail = async (
	data: Omit<FlagRejectedJobData, 'type'>
): Promise<void> => {
	await emailQueueManager.addJob(
		'flag-rejected',
		{ type: 'flag-rejected', ...data },
		{
			priority: 2, // Medium priority for user notifications
			jobId: `flag-rejected-${data.flagId}`
		}
	);
};
