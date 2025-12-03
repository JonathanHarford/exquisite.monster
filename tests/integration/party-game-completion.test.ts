import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { PartyUseCases } from '../../src/lib/server/usecases/PartyUseCases';
import { GameUseCases } from '../../src/lib/server/usecases/GameUseCases';
import { prisma } from '$lib/server/prisma';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import type { Player } from '$lib/types/domain';
import { getPlayers } from './helpers';

// Mock the notification service
vi.mock('$lib/server/services/notificationService', () => ({
	createNotification: vi.fn().mockResolvedValue({ id: 'mock-notification' })
}));

// Mock the expiration queue
vi.mock('$lib/server/queues/expirationQueue', () => ({
	schedulePartyDeadline: vi.fn().mockResolvedValue(undefined),
	scheduleGameExpiration: vi.fn().mockResolvedValue(undefined),
	scheduleTurnExpiration: vi.fn().mockResolvedValue(undefined)
}));

describe('Party Game Completion Logic', () => {
	let players: Player[] = [];
	let testPartyIds: string[] = [];

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
	});

	beforeEach(async () => {
		// Clean up any leftover party data before each test
		try {
			await prisma.playersInSeasons.deleteMany({});
			await prisma.season.deleteMany({});
			await prisma.gameConfig.deleteMany({
				where: {
					id: { startsWith: 'gc_' }
				}
			});
			await prisma.game.deleteMany({
				where: {
					seasonId: { not: null }
				}
			});
		} catch (error) {
			console.warn('Cleanup failed:', error);
		}
	});

	afterEach(async () => {
		// Clean up test data
		for (const partyId of testPartyIds) {
			try {
				await prisma.playersInSeasons.deleteMany({
					where: { seasonId: partyId }
				});
				await prisma.game.deleteMany({
					where: { seasonId: partyId }
				});
				await prisma.season.delete({
					where: { id: partyId }
				}).catch(() => {});
			} catch (error) {
				console.warn(`Failed to clean up party ${partyId}:`, error);
			}
		}
		testPartyIds = [];
	});

	describe('Game completion in parties', () => {
		it('should complete game when n players have played in n-player party', async () => {
			// Create a 2-player party
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Game Completion Test Party',
				minPlayers: 2,
				maxPlayers: 2,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			testPartyIds.push(party.id);

			// Both players join
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);
			
			// Start the party manually
			await PartyUseCases.startParty(party.id, players[0].id);

			// Get the party details to see the created games
			const { games: initialGames } = await PartyUseCases.getPartyDetails(party.id);
			
			// Should have 2 games for 2 players
			expect(initialGames).toHaveLength(2);
			
			// Find the first game and its first turn
			const firstGame = initialGames[0];
			const firstTurn = firstGame.turns.find(turn => !turn.completedAt);
			expect(firstTurn).toBeTruthy();

			// Player 1 completes their first turn (writing)
			await GameUseCases.completeTurn(firstTurn!.id, 'writing', 'First turn content');

			// Get updated game state
			let updatedGame = await GameUseCases.findGameByIdAdmin(firstGame.id);
			expect(updatedGame).toBeTruthy();
			expect(updatedGame!.turns).toHaveLength(2); // First turn completed, second turn created

			// Player 2 completes their turn (drawing) 
			const secondTurn = updatedGame!.turns.find(turn => !turn.completedAt);
			expect(secondTurn).toBeTruthy();
			await GameUseCases.completeTurn(secondTurn!.id, 'drawing', 'Second turn drawing');

			// After 2 players have played in a 2-player party, game should be completed
			updatedGame = await GameUseCases.findGameByIdAdmin(firstGame.id);
			expect(updatedGame!.completedAt).toBeTruthy();
			expect(updatedGame!.turns).toHaveLength(2); // No third turn should be created

			// Check that no additional turn was created after completion
			const allTurnsInGame = await prisma.turn.findMany({
				where: { gameId: firstGame.id },
				orderBy: { orderIndex: 'asc' }
			});
			expect(allTurnsInGame).toHaveLength(2);
		});

		it('should complete party when all games are completed', async () => {
			// Create a 2-player party
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Party Completion Test',
				minPlayers: 2,
				maxPlayers: 2,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			testPartyIds.push(party.id);

			// Both players join and start party
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);
			await PartyUseCases.startParty(party.id, players[0].id);

			// Get games
			const { games } = await PartyUseCases.getPartyDetails(party.id);
			expect(games).toHaveLength(2);

			// Complete all games by completing each turn in each game
			for (const game of games) {
				const firstTurn = game.turns.find(turn => !turn.completedAt);
				if (firstTurn) {
					// Complete first turn
					await GameUseCases.completeTurn(firstTurn.id, 'writing', 'Content');
					
					// Get updated game to find second turn
					const updatedGame = await GameUseCases.findGameByIdAdmin(game.id);
					const secondTurn = updatedGame!.turns.find(turn => !turn.completedAt);
					if (secondTurn) {
						// Complete second turn
						await GameUseCases.completeTurn(secondTurn.id, 'drawing', 'Drawing content');
					}
				}
			}

			// Party should now be completed
			const { party: updatedParty } = await PartyUseCases.getPartyDetails(party.id);
			expect(updatedParty!.status).toBe('completed');
		});
	});
});