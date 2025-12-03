import { prisma } from '$lib/server/prisma';
import type { Notification } from '$lib/types/domain';
import { toDomainNotification } from '$lib/types/domain';
import { logger } from '$lib/server/logger';
import type { Prisma } from '@prisma/client';
import { getMessageTemplate, type MessageData } from '$lib/server/messaging';
import { queueGeneralNotification } from '$lib/server/queues/emailQueue';
import { redis } from '$lib/server/redis';

export interface CreateNotificationData {
	userId: string;
	type: string;
	title?: string; // Made optional since it will be fetched from templates
	body?: string; // Made optional since it will be fetched from templates
	data?: Prisma.JsonValue;
	actionUrl?: string;
	templateData?: MessageData;
}

export interface GetNotificationsOptions {
	page?: number;
	limit?: number;
	unreadOnly?: boolean;
}

export const createNotification = async (data: CreateNotificationData): Promise<Notification> => {
	let title = data.title;
	let body = data.body;

	// If title or body not provided, fetch from template
	if (!title || !body) {
		const templateKey = `notification.${data.type}`;
		const template = await getMessageTemplate(templateKey, data.templateData || {});

		if (template) {
			title = title || template.title;
			body = body || template.body;
		} else {
			// Fallback if template not found
			title = title || `Notification: ${data.type}`;
			body = body || 'You have a new notification.';
			logger.warn(`No template found for notification type: ${data.type}`, {
				templateKey,
				userId: data.userId
			});
		}
	}

	const createData: Prisma.NotificationCreateInput = {
		user: {
			connect: { id: data.userId }
		},
		type: data.type,
		title,
		body
	};

	if (data.data !== undefined) {
		createData.data = data.data as Prisma.InputJsonValue;
	}

	if (data.actionUrl !== undefined) {
		createData.actionUrl = data.actionUrl;
	}

	const notification = await prisma.notification.create({
		data: createData
	});

	logger.info(`Created notification for user ${data.userId}`, {
		notificationId: notification.id,
		type: data.type
	});

	const domainNotification = toDomainNotification(notification);

	try {
		await redis.publish(`notification:${data.userId}`, JSON.stringify(domainNotification));
	} catch (error) {
		logger.error('Failed to publish notification to Redis', {
			userId: data.userId,
			error: error instanceof Error ? error.message : String(error)
		});
	}

	try {
		await queueGeneralNotification({
			notificationId: domainNotification.id,
			notificationType: domainNotification.type,
			userId: domainNotification.userId,
			templateData: data.templateData || {}
		});
	} catch (error) {
		logger.error('Failed to queue notification email', {
			userId: data.userId,
			notificationId: domainNotification.id,
			error: error instanceof Error ? error.message : String(error)
		});
	}

	return domainNotification;
};

export const getNotifications = async (
	userId: string,
	options: GetNotificationsOptions = {}
): Promise<Notification[]> => {
	const { page = 1, limit = 50, unreadOnly = false } = options;
	const skip = (page - 1) * limit;

	const notifications = await prisma.notification.findMany({
		where: {
			userId,
			...(unreadOnly ? { read: false } : {})
		},
		orderBy: {
			createdAt: 'desc'
		},
		skip,
		take: limit
	});

	return notifications.map(toDomainNotification);
};

export const markAllAsRead = async (userId: string): Promise<number> => {
	const result = await prisma.notification.updateMany({
		where: {
			userId,
			read: false
		},
		data: {
			read: true
		}
	});

	logger.info(`Marked all ${result.count} notifications as read for user ${userId}`);

	return result.count;
};

export const markAsRead = async (userId: string, notificationId: string): Promise<boolean> => {
	const result = await prisma.notification.updateMany({
		where: {
			id: notificationId,
			userId, // Ensure user can only mark their own notifications as read
			read: false // Only update if currently unread
		},
		data: {
			read: true
		}
	});

	const wasUpdated = result.count > 0;

	if (wasUpdated) {
		logger.info(`Marked notification ${notificationId} as read for user ${userId}`);
	} else {
		logger.debug(
			`Notification ${notificationId} was already read or doesn't belong to user ${userId}`
		);
	}

	return wasUpdated;
};

export const getUnreadCount = async (userId: string): Promise<number> => {
	return await prisma.notification.count({
		where: {
			userId,
			read: false
		}
	});
};
