import { addJob, removeJob } from '$lib/server/services/queueService';
import { GameUseCases } from '$lib/server/usecases/GameUseCases.js';
import type { Game, Turn } from '$lib/types/domain.js';
import { logger } from '$lib/server/logger.js';

// Job Data Interfaces
export interface TurnExpirationJobData {
	id: string;
	expiresAt: string | Date | null; // Allow string from JSON
	orderIndex: number;
	gameId: string;
}

export interface PartyDeadlineJobData {
	partyId: string;
	deadline: string | Date;
}

// Processors
export const processTurnExpiration = async (data: TurnExpirationJobData): Promise<void> => {
	await GameUseCases.deleteTurnIfExpired(data.id);
};

export const processGameExpiration = async (game: any): Promise<void> => {
	logger.info(`Processing expiration for game ${game.id}`);
	await GameUseCases.completeGameIfExpired(game.id);
};

export const processPartyDeadline = async (data: PartyDeadlineJobData): Promise<void> => {
	logger.info(`Processing party deadline for party ${data.partyId}`);

	try {
		// Import PartyUseCases dynamically to avoid circular dependency
		const { PartyUseCases } = await import('$lib/server/usecases/PartyUseCases.js');
		await PartyUseCases.checkPartyActivation(data.partyId);
	} catch (error) {
		logger.error(`Failed to process party deadline for ${data.partyId}`, error);
		throw error;
	}
};

// Initialization (No-op for backward compatibility if called, but will be removed from startup)
export const initializeExpirationQueues = async (): Promise<void> => {
	// No-op
};

export const scheduleTurnExpiration = async (turn: Turn): Promise<void> => {
	if (!turn.expiresAt) {
		logger.warn(`Cannot schedule expiration for turn ${turn.id} - no expiration date`);
		return;
	}

	const delay = Math.max(0, new Date(turn.expiresAt).getTime() - Date.now());

	const jobData: TurnExpirationJobData = {
		id: turn.id,
		expiresAt: turn.expiresAt,
		orderIndex: turn.orderIndex,
		gameId: turn.gameId
	};

	await addJob('turn-expiration', jobData, {
		delay,
		jobId: `turn-${turn.id}`
	});
	logger.debug(`Scheduled turn expiration for ${turn.id} in ${delay}ms`);
};

export const scheduleGameExpiration = async (game: Game): Promise<void> => {
	if (!game.expiresAt) {
		logger.warn(`Cannot schedule expiration for game ${game.id} - no expiration date`);
		return;
	}

	const delay = Math.max(0, new Date(game.expiresAt).getTime() - Date.now());

	await addJob('game-expiration', game, {
		delay,
		jobId: `game-${game.id}`
	});
	logger.debug(`Scheduled game expiration for ${game.id} in ${delay}ms`);
};

export const schedulePartyDeadline = async (partyId: string, deadline: Date): Promise<void> => {
	const delay = Math.max(0, new Date(deadline).getTime() - Date.now());

	if (delay <= 0) {
		logger.warn(`Cannot schedule party deadline for ${partyId} - deadline is in the past`);
		return;
	}

	const jobData: PartyDeadlineJobData = {
		partyId,
		deadline
	};

	await addJob('party-deadline', jobData, {
		delay,
		jobId: `party-${partyId}`
	});
	logger.debug(`Scheduled party deadline for ${partyId} in ${delay}ms`);
};

export const cancelTurnExpiration = async (turnId: string): Promise<void> => {
	await removeJob(`turn-${turnId}`);
	logger.debug(`Cancelled turn expiration job for ${turnId}`);
};

export const cancelGameExpiration = async (gameId: string): Promise<void> => {
	await removeJob(`game-${gameId}`);
	logger.debug(`Cancelled game expiration job for ${gameId}`);
};
