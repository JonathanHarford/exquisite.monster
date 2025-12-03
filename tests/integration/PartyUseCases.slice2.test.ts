import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { PartyUseCases } from '../../src/lib/server/usecases/PartyUseCases';
import { GameUseCases } from '../../src/lib/server/usecases/GameUseCases';
import { prisma } from '$lib/server/prisma';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import type { Player } from '$lib/types/domain';
import { getPlayers } from './helpers';

// Mock the notification service and queue scheduling
vi.mock('$lib/server/services/notificationService', () => ({
	createNotification: vi.fn().mockResolvedValue({ id: 'mock-notification' })
}));

vi.mock('$lib/server/queues/expirationQueue', () => ({
	schedulePartyDeadline: vi.fn().mockResolvedValue(undefined),
	scheduleGameExpiration: vi.fn().mockResolvedValue(undefined),
	scheduleTurnExpiration: vi.fn().mockResolvedValue(undefined)
}));

describe('PartyUseCases - Slice 2: Game Creation & Turn Assignment', () => {
	let players: Player[] = [];
	let testPartyIds: string[] = [];

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
	});

	beforeEach(async () => {
		// Clean up any leftover party data before each test - be more thorough
		try {
			// Remove ALL player-season associations
			await prisma.playersInSeasons.deleteMany({});

			// Remove ALL seasons (parties)
			await prisma.season.deleteMany({});

			// Remove ALL game configs that start with 'gc_' (party configs)
			await prisma.gameConfig.deleteMany({
				where: {
					id: { startsWith: 'gc_' }
				}
			});

			// Additional cleanup - remove any orphaned games that might reference party configs
			await prisma.game.deleteMany({
				where: {
					seasonId: { not: null }
				}
			});
		} catch (error) {
			console.warn('Cleanup error in PartyUseCases.slice2 beforeEach:', error);
		}
	});

	afterEach(async () => {
		// Clean up test parties and their games
		for (const partyId of testPartyIds) {
			try {
				// Get the gameConfigId before deleting the season
				const season = await prisma.season.findUnique({
					where: { id: partyId },
					select: { gameConfigId: true }
				});

				// First clean up games associated with this party
				await prisma.game.deleteMany({
					where: { seasonId: partyId }
				});

				// Clean up player associations
				await prisma.playersInSeasons.deleteMany({
					where: { seasonId: partyId }
				});

				// Delete the party (season)
				await prisma.season.delete({
					where: { id: partyId }
				});

				// Finally delete the gameConfig if it exists
				if (season?.gameConfigId) {
					await prisma.gameConfig
						.delete({
							where: { id: season.gameConfigId }
						})
						.catch(() => {}); // Ignore errors if already deleted by cascade
				}
			} catch (_error) {
				// Ignore errors if already deleted
			}
		}
		testPartyIds = [];
	});

	describe('Game Creation on Party Activation', () => {
		it('should create N games for N players when party activates', async () => {
			// Create a party
			let party;
			try {
				party = await PartyUseCases.openParty(players[0].id, {
					title: 'Game Creation Test Party',
					minPlayers: 3,
					maxPlayers: 3,
					startDeadline: null,
					turnPassingAlgorithm: 'round-robin' as const,
					allowPlayerInvites: false,
					isLewd: false,
					invitedPlayerIds: [players[1].id, players[2].id]
				});
			} catch (error) {
				console.error('Error in test - openParty failed:', error);
				throw error;
			}
			testPartyIds.push(party.id);

			// Accept invitations
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);
			await PartyUseCases.acceptPartyInvitation(party.id, players[2].id);

			// Manually start the party (new behavior)
			await PartyUseCases.startParty(party.id, players[0].id);

			// Verify party is activated
			const { party: activatedParty, games } = await PartyUseCases.getPartyDetails(party.id);
			expect(activatedParty!.status).toBe('active');
			expect(games).toHaveLength(3); // Should create 3 games for 3 players

			// Verify each game has a first turn assigned
			games.forEach((game, index) => {
				expect(game.turns).toHaveLength(1);
				expect(game.turns[0].playerId).toBe(players[index].id); // Each player gets first turn of one game
				expect(game.turns[0].orderIndex).toBe(0);
				expect(game.turns[0].completedAt).toBeNull(); // Turn should be pending
			});
		});

		it('should assign first turns based on player order', async () => {
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Turn Assignment Test',
				minPlayers: 2,
				maxPlayers: 2,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			testPartyIds.push(party.id);

			// Accept invitation
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);

			// Manually start the party (new behavior)
			await PartyUseCases.startParty(party.id, players[0].id);

			const { games } = await PartyUseCases.getPartyDetails(party.id);
			expect(games).toHaveLength(2);

			// First game should be assigned to first player (party creator)
			expect(games[0].turns[0].playerId).toBe(players[0].id);
			// Second game should be assigned to second player
			expect(games[1].turns[0].playerId).toBe(players[1].id);
		});
	});

	describe('Turn Assignment Algorithms', () => {
		describe('Round-Robin Algorithm', () => {
			it('should assign turns in fixed order', async () => {
				// Create and activate a party
				const party = await PartyUseCases.openParty(players[0].id, {
					title: 'Round Robin Test',
					minPlayers: 3,
					maxPlayers: 3,
					startDeadline: null,
					turnPassingAlgorithm: 'round-robin' as const,
					allowPlayerInvites: false,
					isLewd: false,
					invitedPlayerIds: [players[1].id, players[2].id]
				});
				testPartyIds.push(party.id);

				await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);
				await PartyUseCases.acceptPartyInvitation(party.id, players[2].id);

				// Manually start the party (new behavior)
				await PartyUseCases.startParty(party.id, players[0].id);

				const { games } = await PartyUseCases.getPartyDetails(party.id);
				const firstGame = games[0];

				// Complete the first turn (by players[0])
				await GameUseCases.completeTurn(firstGame.turns[0].id, 'writing', 'Test writing turn');

				// Check that next turn was assigned to players[1] (next in round-robin order)
				const updatedDetails = await PartyUseCases.getPartyDetails(party.id);
				const updatedGame = updatedDetails.games.find(g => g.id === firstGame.id)!;

				expect(updatedGame.turns).toHaveLength(2);
				expect(updatedGame.turns[1].playerId).toBe(players[1].id);
				expect(updatedGame.turns[1].completedAt).toBeNull();
			});

			it('should complete game after all players have taken one turn', async () => {
				const party = await PartyUseCases.openParty(players[0].id, {
					title: 'Round Robin Completion Test',
					minPlayers: 4,
					maxPlayers: 4,
					startDeadline: null,
					turnPassingAlgorithm: 'round-robin' as const,
					allowPlayerInvites: false,
					isLewd: false,
					invitedPlayerIds: [players[1].id, players[2].id, players[3].id]
				});
				testPartyIds.push(party.id);

				await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);
				await PartyUseCases.acceptPartyInvitation(party.id, players[2].id);
				await PartyUseCases.acceptPartyInvitation(party.id, players[3].id);

				// Manually start the party (new behavior)
				await PartyUseCases.startParty(party.id, players[0].id);

				let { games } = await PartyUseCases.getPartyDetails(party.id);
				let game = games[0];
				const gameId = game.id;

				// Complete first turn (players[0]) -> should assign to players[1]
				await GameUseCases.completeTurn(game.turns[0].id, 'writing', 'First turn');
				({ games } = await PartyUseCases.getPartyDetails(party.id));
				game = games.find(g => g.id === gameId)!;

				// Complete second turn (players[1]) -> should assign to players[2]
				await GameUseCases.completeTurn(game.turns[1].id, 'drawing', 'drawing content');
				({ games } = await PartyUseCases.getPartyDetails(party.id));
				game = games.find(g => g.id === gameId)!;

				// Complete third turn (players[2]) -> should assign to players[3]
				await GameUseCases.completeTurn(game.turns[2].id, 'writing', 'Third turn');
				({ games } = await PartyUseCases.getPartyDetails(party.id));
				game = games.find(g => g.id === gameId)!;

				// Complete fourth turn (players[3]) -> should complete the game
				await GameUseCases.completeTurn(game.turns[3].id, 'drawing', 'Fourth turn');
				({ games } = await PartyUseCases.getPartyDetails(party.id));
				game = games.find(g => g.id === gameId)!;

				// Game should be completed with exactly 4 turns (one per player)
				expect(game.turns).toHaveLength(4);
				expect(game.completedAt).not.toBeNull();
			});
		});

		describe('Algorithmic Assignment', () => {
			it('should prioritize players with fewer completed turns', async () => {
				const party = await PartyUseCases.openParty(players[0].id, {
					title: 'Algorithmic Test',
					minPlayers: 3,
					maxPlayers: 3,
					startDeadline: null,
					turnPassingAlgorithm: 'algorithmic' as const,
					allowPlayerInvites: false,
					isLewd: false,
					invitedPlayerIds: [players[1].id, players[2].id]
				});
				testPartyIds.push(party.id);

				await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);
				await PartyUseCases.acceptPartyInvitation(party.id, players[2].id);

				// Manually start the party (new behavior)
				await PartyUseCases.startParty(party.id, players[0].id);

				const { games } = await PartyUseCases.getPartyDetails(party.id);
				const firstGame = games[0];

				// Complete the first turn (players[0])
				await GameUseCases.completeTurn(firstGame.turns[0].id, 'writing', 'First turn');

				// Next turn should be assigned to either players[1] or players[2]
				// (both have 0 completed turns vs players[0] with 1)
				const details = await PartyUseCases.getPartyDetails(party.id);
				const updatedGame = details.games.find(g => g.id === firstGame.id)!;
				const secondTurn = updatedGame.turns[1];

				expect([players[1].id, players[2].id]).toContain(secondTurn.playerId);
				expect(secondTurn.playerId).not.toBe(players[0].id); // Should not assign to player who just completed
			});

			it('should exclude the player who just completed a turn', async () => {
				const party = await PartyUseCases.openParty(players[0].id, {
					title: 'Exclude Current Player Test',
					minPlayers: 2,
					maxPlayers: 2,
					startDeadline: null,
					turnPassingAlgorithm: 'algorithmic' as const,
					allowPlayerInvites: false,
					isLewd: false,
					invitedPlayerIds: [players[1].id]
				});
				testPartyIds.push(party.id);

				await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);

				// Manually start the party (new behavior)
				await PartyUseCases.startParty(party.id, players[0].id);

				const { games } = await PartyUseCases.getPartyDetails(party.id);
				const firstGame = games[0];

				// Complete first turn by players[0]
				await GameUseCases.completeTurn(firstGame.turns[0].id, 'writing', 'First turn');

				// Next turn must be assigned to players[1] (only other option)
				const details = await PartyUseCases.getPartyDetails(party.id);
				const updatedGame = details.games.find(g => g.id === firstGame.id)!;
				const secondTurn = updatedGame.turns[1];

				expect(secondTurn.playerId).toBe(players[1].id);
			});
		});
	});

	describe('Party Status Transitions', () => {
		it('should transition from open to active when max players join', async () => {
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Status Transition Test',
				minPlayers: 2,
				maxPlayers: 2, // Will activate immediately when 2nd player joins
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			testPartyIds.push(party.id);

			// Party should be open initially
			let details = await PartyUseCases.getPartyDetails(party.id);
			expect(details.party!.status).toBe('open');
			expect(details.games).toHaveLength(0);

			// Accept invitation to reach max players
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);

			// Manually start the party (new behavior)
			await PartyUseCases.startParty(party.id, players[0].id);

			// Party should now be active with games created
			details = await PartyUseCases.getPartyDetails(party.id);
			expect(details.party!.status).toBe('active');
			expect(details.games).toHaveLength(2);
		});

		it.skip('should handle deadline activation when min players met', async () => {
			const pastDeadline = new Date(Date.now() - 1000); // 1 second ago

			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Deadline Activation Test',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: pastDeadline,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id, players[2].id]
			});
			testPartyIds.push(party.id);

			// Accept one invitation to meet minimum
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);

			// Manually start the party (new behavior - deadline activation is deprecated)
			await PartyUseCases.startParty(party.id, players[0].id);

			// Party should be activated
			const details = await PartyUseCases.getPartyDetails(party.id);
			expect(details.party!.status).toBe('active');
			expect(details.games).toHaveLength(2); // 2 joined players = 2 games
		});
	});

	describe('Game Progress Tracking', () => {
		it('should track turn completion status correctly', async () => {
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Progress Tracking Test',
				minPlayers: 2,
				maxPlayers: 2,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			testPartyIds.push(party.id);

			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);

			// Manually start the party (new behavior)
			await PartyUseCases.startParty(party.id, players[0].id);

			// Initial state: 2 games, each with 1 pending turn
			let details = await PartyUseCases.getPartyDetails(party.id);
			expect(details.games).toHaveLength(2);
			details.games.forEach((game) => {
				expect(game.turns).toHaveLength(1);
				expect(game.turns[0].completedAt).toBeNull();
			});

			// Complete one turn
			const firstGame = details.games[0];
			const firstTurnId = firstGame.turns[0].id;
			await GameUseCases.completeTurn(firstTurnId, 'writing', 'Test content');

			// Check progress after completion
			details = await PartyUseCases.getPartyDetails(party.id);
			const updatedGame = details.games.find(g => g.id === firstGame.id)!;

			expect(updatedGame.turns).toHaveLength(2); // Original + new turn
			expect(updatedGame.turns[0].completedAt).not.toBeNull(); // First turn completed
			expect(updatedGame.turns[1].completedAt).toBeNull(); // Second turn pending
		});
	});
});
