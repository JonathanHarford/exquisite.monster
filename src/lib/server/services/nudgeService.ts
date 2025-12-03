import { prisma } from '$lib/server/prisma';
import { createNotification } from './notificationService';
import type { Turn, Player } from '../../types/domain';
import { logger } from '../logger';

const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface NudgeResult {
	success: boolean;
	message: string;
	cooldownRemainingHours?: number;
}

/**
 * Send a nudge notification to a player about their pending turn
 * Includes 24-hour cooldown per turn to prevent spam
 */
export async function nudgePlayer(
	nudgerPlayerId: string,
	nudgedPlayerId: string,
	turnId: string,
	gameId: string
): Promise<NudgeResult> {
	try {
		// Check if nudge is on cooldown
		const cooldownCheck = await checkNudgeCooldown(nudgedPlayerId, turnId);
		if (!cooldownCheck.canSendNudge) {
			return {
				success: false,
				message: 'Nudge is on cooldown',
				cooldownRemainingHours: cooldownCheck.remainingHours
			};
		}

		// Get player and turn information
		const [nudgedPlayer, turn] = await Promise.all([
			prisma.player.findUnique({
				where: { id: nudgedPlayerId },
				select: { username: true }
			}),
			prisma.turn.findUnique({
				where: { id: turnId },
				select: { createdAt: true, orderIndex: true }
			})
		]);

		if (!nudgedPlayer || !turn) {
			return {
				success: false,
				message: 'Player or turn not found'
			};
		}

		// Calculate wait time
		const waitTimeMs = Date.now() - turn.createdAt.getTime();
		const waitTimeHours = Math.floor(waitTimeMs / (1000 * 60 * 60));
		const waitTimeDisplay = formatWaitTime(waitTimeMs);

		// Get nudge count for this turn
		const existingNudges = await prisma.notification.count({
			where: {
				userId: nudgedPlayerId,
				type: 'nudge',
				data: {
					path: ['turnId'],
					equals: turnId
				}
			}
		});

		// Create nudge notification
		await createNotification({
			userId: nudgedPlayerId,
			type: 'nudge',
			data: {
				turnId,
				gameId,
				nudgerPlayerId,
				nudgeCount: existingNudges + 1,
				waitTimeHours,
				lastNudgeAt: new Date().toISOString()
			},
			actionUrl: `/play/${turnId}`,
			templateData: {
				username: nudgedPlayer.username,
				waitTime: waitTimeDisplay,
				turnIndex: (turn.orderIndex + 1).toString()
			}
		});

		logger.info(`Nudge sent from ${nudgerPlayerId} to ${nudgedPlayerId} for turn ${turnId}`);

		return {
			success: true,
			message: `Nudge sent to ${nudgedPlayer.username}`
		};
	} catch (error) {
		logger.error('Failed to send nudge', error);
		return {
			success: false,
			message: 'Failed to send nudge'
		};
	}
}

/**
 * Check if a nudge can be sent (not on cooldown)
 */
async function checkNudgeCooldown(
	playerId: string,
	turnId: string
): Promise<{ canSendNudge: boolean; remainingHours?: number }> {
	const cutoffTime = new Date(Date.now() - NUDGE_COOLDOWN_MS);

	const recentNudge = await prisma.notification.findFirst({
		where: {
			userId: playerId,
			type: 'nudge',
			createdAt: {
				gte: cutoffTime
			},
			data: {
				path: ['turnId'],
				equals: turnId
			}
		},
		orderBy: { createdAt: 'desc' }
	});

	if (!recentNudge) {
		return { canSendNudge: true };
	}

	const timeSinceLastNudge = Date.now() - recentNudge.createdAt.getTime();
	const remainingCooldown = NUDGE_COOLDOWN_MS - timeSinceLastNudge;
	const remainingHours = Math.ceil(remainingCooldown / (1000 * 60 * 60));

	return {
		canSendNudge: false,
		remainingHours
	};
}

/**
 * Format wait time into human-readable string
 */
function formatWaitTime(waitTimeMs: number): string {
	const hours = Math.floor(waitTimeMs / (1000 * 60 * 60));
	const days = Math.floor(hours / 24);

	if (days > 0) {
		const remainingHours = hours % 24;
		if (remainingHours === 0) {
			return `${days} ${days === 1 ? 'day' : 'days'}`;
		}
		return `${days}d ${remainingHours}h`;
	}

	if (hours > 0) {
		return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
	}

	const minutes = Math.floor(waitTimeMs / (1000 * 60));
	return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/**
 * Get nudge statistics for a turn (for UI display)
 */
export async function getTurnNudgeStats(turnId: string): Promise<{
	totalNudges: number;
	lastNudgeAt?: Date;
	canReceiveNudge: boolean;
	cooldownRemainingHours?: number;
}> {
	const turn = await prisma.turn.findUnique({
		where: { id: turnId },
		select: { playerId: true }
	});

	if (!turn) {
		return {
			totalNudges: 0,
			canReceiveNudge: false
		};
	}

	const [nudgeCount, cooldownCheck] = await Promise.all([
		prisma.notification.count({
			where: {
				userId: turn.playerId,
				type: 'nudge',
				data: {
					path: ['turnId'],
					equals: turnId
				}
			}
		}),
		checkNudgeCooldown(turn.playerId, turnId)
	]);

	const lastNudge = await prisma.notification.findFirst({
		where: {
			userId: turn.playerId,
			type: 'nudge',
			data: {
				path: ['turnId'],
				equals: turnId
			}
		},
		orderBy: { createdAt: 'desc' },
		select: { createdAt: true }
	});

	return {
		totalNudges: nudgeCount,
		lastNudgeAt: lastNudge?.createdAt,
		canReceiveNudge: cooldownCheck.canSendNudge,
		cooldownRemainingHours: cooldownCheck.remainingHours
	};
}
