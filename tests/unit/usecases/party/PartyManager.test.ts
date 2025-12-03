import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PartyManager } from '$lib/server/usecases/party/PartyManager';
import { prisma } from '$lib/server/prisma';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import {
	getPartyById,
	getPartyPlayers,
	activateParty
} from '$lib/server/services/partyService';

// Mock dependencies
vi.mock('$lib/server/prisma', () => ({
	prisma: {
		player: {
			findUnique: vi.fn(),
			findMany: vi.fn()
		},
		season: {
			findUnique: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		},
		playersInSeasons: {
			findMany: vi.fn()
		},
		game: {
			findMany: vi.fn(),
			updateMany: vi.fn()
		},
		$transaction: vi.fn((callback) => callback(prisma))
	}
}));

vi.mock('$lib/server/services/partyService', () => ({
	getPartyById: vi.fn(),
	getPartyPlayers: vi.fn(),
	activateParty: vi.fn(),
	updatePartySettings: vi.fn(),
	createParty: vi.fn(),
	acceptInvitation: vi.fn(),
	invitePlayersToParty: vi.fn(),
	getJoinedPlayerCount: vi.fn(),
	canPlayerCreateParty: vi.fn(),
}));

vi.mock('$lib/server/services/notificationService', () => ({
	createNotification: vi.fn()
}));

vi.mock('$lib/server/queues/expirationQueue', () => ({
	schedulePartyDeadline: vi.fn()
}));

vi.mock('$lib/server/usecases/GameUseCases', () => {
	const mockSoftDeleteGame = vi.fn().mockResolvedValue(undefined);
	const mockCreateGame = vi.fn().mockResolvedValue({ id: 'game1' });
	const mockCreateTurn = vi.fn().mockResolvedValue({ id: 'turn1' });

	return {
		GameUseCases: {
			createGame: mockCreateGame,
			createTurn: mockCreateTurn,
			softDeleteGame: mockSoftDeleteGame
		}
	};
});

describe('PartyManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('startParty', () => {
		it('should start party if user is creator', async () => {
			const mockParty = {
				id: 'season1',
				createdBy: 'user1',
				status: 'open',
				gameConfig: { isLewd: false }
			};
			vi.mocked(getPartyById).mockResolvedValue(mockParty as any);
			(prisma.player.findUnique as any).mockResolvedValue({ isAdmin: false });
			vi.mocked(getPartyPlayers).mockResolvedValue([{ playerId: 'p1', joinedAt: new Date() }] as any);
			vi.mocked(activateParty).mockResolvedValue(true);
			(prisma.player.findMany as any).mockResolvedValue([{ id: 'p1', hideLewdContent: false }]);

			// Ensure GameUseCases mocks are reset/setup
			vi.mocked(GameUseCases.createGame).mockResolvedValue({ id: 'game1' } as any);
			vi.mocked(GameUseCases.createTurn).mockResolvedValue({ id: 'turn1' } as any);

			await PartyManager.startParty('season1', 'user1');

			expect(activateParty).toHaveBeenCalledWith('season1');
		});

		it('should throw error if user is not creator or admin', async () => {
			const mockParty = {
				id: 'season1',
				createdBy: 'user1',
				status: 'open'
			};
			vi.mocked(getPartyById).mockResolvedValue(mockParty as any);
			(prisma.player.findUnique as any).mockResolvedValue({ isAdmin: false });

			await expect(PartyManager.startParty('season1', 'user2')).rejects.toThrow('Only the party creator or an admin can start the party');
		});
	});

	describe('cancelParty', () => {
		it('should soft delete games and delete season', async () => {
			const mockParty = {
				id: 'season1',
				createdBy: 'user1',
				title: 'Test Party'
			};
			vi.mocked(getPartyById).mockResolvedValue(mockParty as any);
			(prisma.player.findUnique as any).mockResolvedValue({ isAdmin: false });
			(prisma.game.findMany as any).mockResolvedValue([{ id: 'game1' }, { id: 'game2' }]);

			await PartyManager.cancelParty('season1', 'user1');

			expect(GameUseCases.softDeleteGame).toHaveBeenCalledWith('game1');
			expect(GameUseCases.softDeleteGame).toHaveBeenCalledWith('game2');
			expect(prisma.season.delete).toHaveBeenCalledWith({ where: { id: 'season1' } });
		});
	});
});
