import { prisma } from '$lib/server/prisma';
import type { TurnFlag } from '$lib/types/domain';
import { toDomainTurnFlag } from '$lib/types/domain';
import { logger } from '$lib/server/logger';
import { createTurnFlag } from '$lib/server/services/flagService';
import {
	queueFlagSubmittedEmail,
	queueFlagConfirmedEmail,
	queueFlagRejectedEmail
} from '$lib/server/queues/emailQueue';
import { clerkClient } from 'svelte-clerk/server';
import { createNotification } from '../services/notificationService';

export class FlagUseCases {
	static async flagTurn(
		turnId: string,
		playerId: string,
		reason: 'spam' | 'offensive' | 'other',
		explanation?: string
	): Promise<TurnFlag> {
		const existingFlags = await prisma.turnFlag.findMany({
			where: {
				playerId,
				resolvedAt: null
			}
		});

		if (existingFlags.length > 0) {
			throw new Error('Player already has a pending flag');
		}

		const turn = await prisma.turn.findUnique({
			where: { id: turnId },
			select: { gameId: true, createdAt: true }
		});

		if (!turn) {
			throw new Error('Turn not found');
		}

		const pendingTurns = await prisma.turn.findMany({
			where: {
				gameId: turn.gameId,
				createdAt: { gt: turn.createdAt },
				completedAt: null
			}
		});
		logger.info(`Found ${pendingTurns.length} pending turns after flagging turn ${turnId}`);

		if (pendingTurns.length > 0) {
			await prisma.turn.deleteMany({
				where: {
					id: { in: pendingTurns.map((t) => t.id) }
				}
			});
			logger.info(`Deleted ${pendingTurns.length} pending turns after flagging turn ${turnId}`);
		}

		const flag = await createTurnFlag(turnId, playerId, reason, explanation);

		try {
			const [flagger, turnWithCreator] = await Promise.all([
				prisma.player.findUnique({ where: { id: playerId }, select: { username: true } }),
				prisma.turn.findUnique({
					where: { id: turnId },
					include: { player: { select: { username: true } } }
				})
			]);

			if (flagger && turnWithCreator) {
				await queueFlagSubmittedEmail({
					flagId: flag.id,
					turnId,
					gameId: turn.gameId,
					reason,
					explanation,
					flaggerUsername: flagger.username,
					turnCreatorUsername: turnWithCreator.player.username
				});

				const adminUsers = await prisma.player.findMany({
					where: { isAdmin: true },
					select: { id: true }
				});

				for (const admin of adminUsers) {
					try {
						await createNotification({
							userId: admin.id,
							type: 'admin_flag',
							data: {
								flagId: flag.id,
								turnId,
								gameId: turn.gameId,
								reason,
								explanation,
								flaggerUsername: flagger.username,
								turnCreatorUsername: turnWithCreator.player.username
							},
							actionUrl: `/g/${turn.gameId}`,
							templateData: {
								flaggerUsername: flagger.username,
								turnCreatorUsername: turnWithCreator.player.username,
								reason,
								explanation,
								gameId: turn.gameId,
								explanationSuffix: explanation ? `: ${explanation}` : '',
								explanationHtml: explanation
									? `<p><strong>Explanation:</strong> ${explanation}</p>`
									: ''
							}
						});
					} catch (notificationError) {
						logger.error(`Failed to create admin notification for ${admin.id}:`, notificationError);
					}
				}
			}
		} catch (error) {
			logger.error('Failed to queue flag submitted email:', error);
		}

		return flag;
	}

	static async rejectFlag(flagId: string, adminId?: string): Promise<TurnFlag> {
		const flag = await prisma.turnFlag.findUnique({
			where: {
				id: flagId,
				resolvedAt: null
			},
			include: {
				turn: {
					include: {
						player: { select: { username: true } }
					}
				},
				player: { select: { username: true } }
			}
		});

		if (!flag) {
			throw new Error(`Flag ${flagId} not found or already resolved`);
		}

		const now = new Date();
		const updatedFlag = await prisma.turnFlag.update({
			where: {
				id: flagId
			},
			data: {
				resolvedAt: now
			}
		});

		logger.info(`Rejected flag ${flagId} on turn ${flag.turnId} by admin ${adminId || 'system'}`);

		if (adminId) {
			try {
				const [admin, flaggerUser] = await Promise.all([
					prisma.player.findUnique({ where: { id: adminId }, select: { username: true } }),
					clerkClient.users.getUser(flag.playerId)
				]);

				if (admin && flaggerUser?.emailAddresses?.[0]?.emailAddress) {
					await queueFlagRejectedEmail({
						flagId: flag.id,
						turnId: flag.turnId,
						gameId: flag.turn.gameId,
						reason: flag.reason as 'spam' | 'offensive' | 'other',
						explanation: flag.explanation || undefined,
						flaggerUsername: flag.player.username,
						turnCreatorUsername: flag.turn.player.username,
						adminUsername: admin.username,
						flaggerEmail: flaggerUser.emailAddresses[0].emailAddress
					});
				}

				if (admin) {
					try {
						await createNotification({
							userId: flag.playerId,
							type: 'flag_rejected',
							data: {
								flagId: flag.id,
								turnId: flag.turnId,
								gameId: flag.turn.gameId,
								reason: flag.reason,
								adminUsername: admin.username
							},
							templateData: {
								turnCreatorUsername: flag.turn.player.username,
								reason: flag.reason,
								explanation: flag.explanation,
								adminUsername: admin.username,
								explanationHtml: flag.explanation
									? `<p><strong>Your explanation:</strong> ${flag.explanation}</p>`
									: ''
							}
						});
					} catch (notificationError) {
						logger.error(
							`Failed to create flag rejection notification for ${flag.playerId}:`,
							notificationError
						);
					}
				}
			} catch (error) {
				logger.error('Failed to queue flag rejected email:', error);
			}
		}

		return toDomainTurnFlag(updatedFlag);
	}

	static async confirmFlag(flagId: string, adminId?: string): Promise<TurnFlag> {
		const flag = await prisma.turnFlag.findUnique({
			where: {
				id: flagId,
				resolvedAt: null
			},
			include: {
				turn: {
					include: {
						player: { select: { username: true } }
					}
				},
				player: { select: { username: true } }
			}
		});

		if (!flag) {
			throw new Error(`Flag ${flagId} not found or already resolved`);
		}

		if (flag.turn.rejectedAt) {
			throw new Error(`Turn ${flag.turnId} already rejected`);
		}

		const now = new Date();
		const [, updatedFlag] = await prisma.$transaction([
			prisma.turn.update({
				where: { id: flag.turnId },
				data: {
					rejectedAt: now
				}
			}),
			prisma.turnFlag.update({
				where: { id: flagId },
				data: {
					resolvedAt: now
				}
			})
		]);

		logger.info(
			`Confirmed flag ${flagId}, rejected turn ${flag.turnId} by admin ${adminId || 'system'}`
		);

		if (adminId) {
			try {
				const [admin, turnCreatorUser] = await Promise.all([
					prisma.player.findUnique({ where: { id: adminId }, select: { username: true } }),
					clerkClient.users.getUser(flag.turn.playerId)
				]);

				if (admin && turnCreatorUser?.emailAddresses?.[0]?.emailAddress) {
					await queueFlagConfirmedEmail({
						flagId: flag.id,
						turnId: flag.turnId,
						gameId: flag.turn.gameId,
						reason: flag.reason as 'spam' | 'offensive' | 'other',
						explanation: flag.explanation || undefined,
						flaggerUsername: flag.player.username,
						turnCreatorUsername: flag.turn.player.username,
						adminUsername: admin.username,
						turnCreatorEmail: turnCreatorUser.emailAddresses[0].emailAddress
					});
				}

				if (admin) {
					try {
						await createNotification({
							userId: flag.turn.playerId,
							type: 'turn_rejected',
							data: {
								flagId: flag.id,
								turnId: flag.turnId,
								gameId: flag.turn.gameId,
								reason: flag.reason,
								explanation: flag.explanation,
								adminUsername: admin.username
							},
							templateData: {
								reason: flag.reason,
								explanation: flag.explanation,
								adminUsername: admin.username,
								explanationSuffix: flag.explanation ? `. Reason: ${flag.explanation}` : '',
								explanationHtml: flag.explanation
									? `<p><strong>Reason:</strong> ${flag.explanation}</p>`
									: ''
							}
						});
					} catch (notificationError) {
						logger.error(
							`Failed to create turn rejection notification for ${flag.turn.playerId}:`,
							notificationError
						);
					}
				}
			} catch (error) {
				logger.error('Failed to queue flag confirmed email:', error);
			}
		}

		return toDomainTurnFlag(updatedFlag);
	}
}
