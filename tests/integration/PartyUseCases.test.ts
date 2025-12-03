import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { PartyUseCases } from '../../src/lib/server/usecases/PartyUseCases';
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

describe('PartyUseCases', () => {
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
			console.warn('Cleanup error in PartyUseCases beforeEach:', error);
		}
	});

	afterEach(async () => {
		// Clean up test parties and their player associations
		for (const partyId of testPartyIds) {
			try {
				// Get the gameConfigId before deleting the season
				const season = await prisma.season.findUnique({
					where: { id: partyId },
					select: { gameConfigId: true }
				});

				// First clean up player associations
				await prisma.playersInSeasons.deleteMany({
					where: { seasonId: partyId }
				});

				// Then delete the party (season)
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

	describe('openParty', () => {
		it.skip('should create a new party with all options', async () => {
			const partyOptions = {
				title: 'Test Party Creation',
				minPlayers: 3,
				maxPlayers: 6,
				startDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // 2 days from now
				turnPassingAlgorithm: 'algorithmic' as const,
				allowPlayerInvites: true,
				isLewd: false,
				invitedPlayerIds: [players[1].id, players[2].id, players[3].id]
			};

			const party = await PartyUseCases.openParty(players[0].id, partyOptions);
			testPartyIds.push(party.id);

			expect(party.title).toBe(partyOptions.title);
			expect(party.minPlayers).toBe(partyOptions.minPlayers);
			expect(party.maxPlayers).toBe(partyOptions.maxPlayers);
			expect(party.turnPassingAlgorithm).toBe(partyOptions.turnPassingAlgorithm);
			expect(party.allowPlayerInvites).toBe(partyOptions.allowPlayerInvites);
			expect(party.status).toBe('open');
			expect(party.gameConfig.isLewd).toBe(partyOptions.isLewd);

			// Verify players were invited
			const { seasonPlayers: partyPlayers } = await PartyUseCases.getPartyDetails(party.id);
			expect(partyPlayers).toHaveLength(4); // Creator + 3 invited

			// Creator should be joined, others should be invited only
			const creator = partyPlayers.find((p) => p.playerId === players[0].id);
			const invitedPlayers = partyPlayers.filter((p) => p.playerId !== players[0].id);

			expect(creator!.joinedAt).not.toBeNull();
			invitedPlayers.forEach((player) => {
				expect(player.joinedAt).toBeNull();
				expect(player.invitedAt).not.toBeNull();
			});
		});

		it('should create party without deadline', async () => {
			const partyOptions = {
				title: 'No Deadline Party',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			};

			const party = await PartyUseCases.openParty(players[0].id, partyOptions);
			testPartyIds.push(party.id);

			expect(party.startDeadline).toBeNull();
			expect(party.status).toBe('open');
		});

		it('should handle lewd content setting', async () => {
			const partyOptions = {
				title: 'Adult Content Party',
				minPlayers: 2,
				maxPlayers: 3,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: true,
				invitedPlayerIds: [players[1].id]
			};

			const party = await PartyUseCases.openParty(players[0].id, partyOptions);
			testPartyIds.push(party.id);

			expect(party.gameConfig.isLewd).toBe(true);
		});
	});

	describe('acceptPartyInvitation', () => {
		let partyId: string;

		beforeEach(async () => {
			try {
				const party = await PartyUseCases.openParty(players[0].id, {
					title: 'Invitation Test Party',
					minPlayers: 2,
					maxPlayers: 4,
					startDeadline: null,
					turnPassingAlgorithm: 'round-robin' as const,
					allowPlayerInvites: false,
					isLewd: false,
					invitedPlayerIds: [players[1].id, players[2].id]
				});
				partyId = party.id;
				testPartyIds.push(partyId);
			} catch (error) {
				console.error('Error in beforeEach openParty:', error);
				throw error; // Re-throw to fail the test if setup fails
			}
		});

		it('should accept invitation successfully', async () => {
			const success = await PartyUseCases.acceptPartyInvitation(partyId, players[1].id);
			expect(success).toBe(true);

			const { seasonPlayers: partyPlayers } = await PartyUseCases.getPartyDetails(partyId);
			const acceptedPlayer = partyPlayers.find((p) => p.playerId === players[1].id);
			expect(acceptedPlayer!.joinedAt).not.toBeNull();
		});

		it('should trigger activation check when max players reached', async () => {
			// Accept invitations to reach max players (creator + 2 = 3, but max is 4)
			await PartyUseCases.acceptPartyInvitation(partyId, players[1].id);
			await PartyUseCases.acceptPartyInvitation(partyId, players[2].id);

			// Create a party with max players = 3 using a different creator
			const smallParty = await PartyUseCases.openParty(players[3].id, {
				title: 'Small Party',
				minPlayers: 2,
				maxPlayers: 3, // This should trigger activation when all join
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[0].id, players[1].id]
			});
			testPartyIds.push(smallParty.id);

			// Accept both invitations
			await PartyUseCases.acceptPartyInvitation(smallParty.id, players[0].id);
			await PartyUseCases.acceptPartyInvitation(smallParty.id, players[1].id);

			// Manually start the party (new behavior)
			await PartyUseCases.startParty(smallParty.id, players[3].id);

			const { party } = await PartyUseCases.getPartyDetails(smallParty.id);
			expect(party!.status).toBe('active'); // Should be activated
		});
	});

	describe('invitePlayersToExistingParty', () => {
		let partyId: string;

		beforeEach(async () => {
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Invite Test Party',
				minPlayers: 2,
				maxPlayers: 5,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: true, // Allow player invites
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			partyId = party.id;
			testPartyIds.push(partyId);
		});

		it('should allow creator to invite additional players', async () => {
			const success = await PartyUseCases.invitePlayersToExistingParty(
				partyId,
				[players[2].id, players[3].id],
				players[0].id
			);
			expect(success).toBe(true);

			const { seasonPlayers: partyPlayers } = await PartyUseCases.getPartyDetails(partyId);
			expect(partyPlayers).toHaveLength(4); // Creator + 3 invited
		});

		it('should prevent invites when allowPlayerInvites is false', async () => {
			// Create party without player invite permission using a different creator
			const restrictedParty = await PartyUseCases.openParty(players[2].id, {
				title: 'Restricted Party',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			testPartyIds.push(restrictedParty.id);

			const success = await PartyUseCases.invitePlayersToExistingParty(
				restrictedParty.id,
				[players[2].id],
				players[0].id
			);
			expect(success).toBe(false);
		});
	});

	describe('checkPartyActivation', () => {
		it('should activate party when max players reached', async () => {
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Max Players Test',
				minPlayers: 2,
				maxPlayers: 3,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id, players[2].id]
			});
			testPartyIds.push(party.id);

			// Accept invitations to reach max players
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);
			await PartyUseCases.acceptPartyInvitation(party.id, players[2].id);

			// Manually start the party (new behavior)
			await PartyUseCases.startParty(party.id, players[0].id);

			const { party: updatedParty } = await PartyUseCases.getPartyDetails(party.id);
			expect(updatedParty!.status).toBe('active');
		});

		it.skip('should activate party when deadline passed with min players', async () => {
			const pastDeadline = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Deadline Test',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: pastDeadline,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id, players[2].id]
			});
			testPartyIds.push(party.id);

			// Accept one invitation to meet min players
			await PartyUseCases.acceptPartyInvitation(party.id, players[1].id);

			// Manually trigger activation check
			await PartyUseCases.checkPartyActivation(party.id);

			const { party: updatedParty } = await PartyUseCases.getPartyDetails(party.id);
			expect(updatedParty!.status).toBe('active');
		});

		it.skip('should not activate party when deadline passed but min players not met', async () => {
			const pastDeadline = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Insufficient Players Test',
				minPlayers: 3, // Need 3 but only creator is joined
				maxPlayers: 4,
				startDeadline: pastDeadline,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id, players[2].id]
			});
			testPartyIds.push(party.id);

			// Don't accept any invitations - only creator is joined (1 < 3 min)
			await PartyUseCases.checkPartyActivation(party.id);

			const { party: updatedParty } = await PartyUseCases.getPartyDetails(party.id);
			expect(updatedParty!.status).toBe('open'); // Should remain open
		});
	});

	describe('getPartyDetails', () => {
		let partyId: string;

		beforeEach(async () => {
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Details Test Party',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id, players[2].id]
			});
			partyId = party.id;
			testPartyIds.push(partyId);
		});

		it('should return party details with player information', async () => {
			const { party, seasonPlayers, players: partyPlayers } = await PartyUseCases.getPartyDetails(partyId);

			expect(party).toBeDefined();
			expect(party!.id).toBe(partyId);
			expect(party!.title).toBe('Details Test Party');

			expect(seasonPlayers).toHaveLength(3); // Creator + 2 invited
			expect(partyPlayers).toHaveLength(3);

			// Check that player details are included
			partyPlayers.forEach((player) => {
				expect(player.username).toBeDefined();
				expect(player.imageUrl).toBeDefined();
			});
		});

		it('should return null for non-existent party', async () => {
			const { party, seasonPlayers, players: partyPlayers } = await PartyUseCases.getPartyDetails('non-existent');

			expect(party).toBeNull();
			expect(seasonPlayers).toEqual([]);
			expect(partyPlayers).toEqual([]);
		});
	});

	describe('Party Completion', () => {
		let partyId: string;

		beforeEach(async () => {
			const party = await PartyUseCases.openParty(players[0].id, {
				title: 'Completion Test Party',
				minPlayers: 2,
				maxPlayers: 2, // Set to 2 so accepting 1 invitation will activate
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				invitedPlayerIds: [players[1].id]
			});
			partyId = party.id;
			testPartyIds.push(partyId);
		});

		describe('checkAndHandlePartyCompletion', () => {
			it('should not complete party when not active', async () => {
				const wasCompleted = await PartyUseCases.checkAndHandlePartyCompletion(partyId);
				expect(wasCompleted).toBe(false);

				const { party } = await PartyUseCases.getPartyDetails(partyId);
				expect(party!.status).toBe('open');
			});

			it('should not complete party when no games exist', async () => {
				// Accept invitation and activate party
				await PartyUseCases.acceptPartyInvitation(partyId, players[1].id);
				await PartyUseCases.activatePartyIfReady(partyId);

				const wasCompleted = await PartyUseCases.checkAndHandlePartyCompletion(partyId);
				expect(wasCompleted).toBe(false);

				const { party } = await PartyUseCases.getPartyDetails(partyId);
				expect(party!.status).toBe('active');
			});

			it('should complete party when all games are finished', async () => {
				// Accept invitation and activate party
				await PartyUseCases.acceptPartyInvitation(partyId, players[1].id);
				await PartyUseCases.activatePartyIfReady(partyId);

				// Mark all existing games in the party as completed
				await prisma.game.updateMany({
					where: { seasonId: partyId },
					data: { completedAt: new Date() }
				});

				const wasCompleted = await PartyUseCases.checkAndHandlePartyCompletion(partyId);
				expect(wasCompleted).toBe(true);

				const { party } = await PartyUseCases.getPartyDetails(partyId);
				expect(party!.status).toBe('completed');
			});
		});

		describe('getCompletedGamesForParty', () => {
			beforeEach(async () => {
				// Accept invitation and activate party for these tests
				await PartyUseCases.acceptPartyInvitation(partyId, players[1].id);
				await PartyUseCases.activatePartyIfReady(partyId);
			});

			it('should return completed games respecting lewd content filter', async () => {
				// Create configs
				const testId = `${Date.now()}-${Math.random()}`;
				const regularConfig = await prisma.gameConfig.create({
					data: {
						id: `test-config-regular-${testId}`,
						minTurns: 5,
						maxTurns: 10,
						writingTimeout: '7d',
						drawingTimeout: '7d',
						gameTimeout: '30d',
						isLewd: false
					}
				});

				const lewdConfig = await prisma.gameConfig.create({
					data: {
						id: `test-config-lewd-${testId}`,
						minTurns: 5,
						maxTurns: 10,
						writingTimeout: '7d',
						drawingTimeout: '7d',
						gameTimeout: '30d',
						isLewd: true
					}
				});

				// Create completed games
				const regularGame = await prisma.game.create({
					data: {
						id: `test-game-${Date.now()}-${Math.random()}-regular`,
						seasonId: partyId,
						configId: regularConfig.id,
						expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
						completedAt: new Date()
					}
				});

				const _lewdGame = await prisma.game.create({
					data: {
						id: `test-game-${Date.now()}-${Math.random()}-lewd`,
						seasonId: partyId,
						configId: lewdConfig.id,
						expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
						completedAt: new Date()
					}
				});

				// Test with lewd content hidden
				const safegames = await PartyUseCases.getCompletedGamesForParty(partyId, true);
				expect(safegames).toHaveLength(1);
				expect(safegames[0].id).toBe(regularGame.id);

				// Test with lewd content shown
				const allGames = await PartyUseCases.getCompletedGamesForParty(partyId, false);
				expect(allGames).toHaveLength(2);
			});

			it('should return empty array for party with no completed games', async () => {
				const games = await PartyUseCases.getCompletedGamesForParty(partyId, false);
				expect(games).toHaveLength(0);
			});
		});

	});
});
