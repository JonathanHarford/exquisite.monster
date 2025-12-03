import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import {
	createParty,
	getPartyById,
	getPartyPlayers,
	acceptInvitation,
	invitePlayersToParty,
	getJoinedPlayerCount,
	activateParty,
	// canPlayerCreateParty,
	checkPartyCompletion,
	getCompletedPartyGames
} from '../../../src/lib/server/services/partyService';
import { prisma } from '$lib/server/prisma';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import type { Player } from '$lib/types/domain';
import { getPlayers } from '../helpers';

describe('partyService', () => {
	let players: Player[] = [];
	let testPartyIds: string[] = [];

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4);
	});

	afterEach(async () => {
		// Clean up test data
		for (const partyId of testPartyIds) {
			// First clean up player associations
			await prisma.playersInSeasons
				.deleteMany({
					where: { seasonId: partyId }
				})
				.catch(() => {});

			// Then delete the party
			await prisma.season
				.delete({
					where: { id: partyId }
				})
				.catch(() => {}); // Ignore errors if already deleted
		}
		testPartyIds = [];
	});

	describe('createParty', () => {
		it('should create a party with correct configuration', async () => {
			const partyData = {
				title: 'Test Party',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: true,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id, players[2].id]
			};

			const party = await createParty(partyData);
			testPartyIds.push(party.id);

			expect(party.title).toBe(partyData.title);
			expect(party.minPlayers).toBe(partyData.minPlayers);
			expect(party.maxPlayers).toBe(partyData.maxPlayers);
			expect(party.turnPassingAlgorithm).toBe(partyData.turnPassingAlgorithm);
			expect(party.allowPlayerInvites).toBe(partyData.allowPlayerInvites);
			expect(party.status).toBe('open');
			expect(party.gameConfig.isLewd).toBe(partyData.isLewd);
		});

		it('should create party with creator as accepted player', async () => {
			const partyData = {
				title: 'Creator Test Party',
				minPlayers: 2,
				maxPlayers: 3,
				startDeadline: null,
				turnPassingAlgorithm: 'algorithmic' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id]
			};

			const party = await createParty(partyData);
			testPartyIds.push(party.id);

			const partyPlayers = await getPartyPlayers(party.id);
			const creator = partyPlayers.find((p) => p.playerId === players[0].id);
			const invitedPlayer = partyPlayers.find((p) => p.playerId === players[1].id);

			expect(creator).toBeDefined();
			expect(creator!.joinedAt).not.toBeNull(); // Creator is auto-joined
			expect(invitedPlayer).toBeDefined();
			expect(invitedPlayer!.joinedAt).toBeNull(); // Invited player not yet joined
		});
	});

	describe('getPartyById', () => {
		let testPartyId: string;

		beforeEach(async () => {
			const party = await createParty({
				title: 'Test Party',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id]
			});
			testPartyId = party.id;
			testPartyIds.push(party.id);
		});

		it('should return party with correct data', async () => {
			const party = await getPartyById(testPartyId);

			expect(party).toBeDefined();
			expect(party!.id).toBe(testPartyId);
			expect(party!.title).toBe('Test Party');
			expect(party!.status).toBe('open');
		});

		it('should return null for non-existent party', async () => {
			const party = await getPartyById('non-existent-id');
			expect(party).toBeNull();
		});
	});

	describe('acceptInvitation', () => {
		let testPartyId: string;

		beforeEach(async () => {
			const party = await createParty({
				title: 'Invitation Test Party',
				minPlayers: 2,
				maxPlayers: 3,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id, players[2].id]
			});
			testPartyId = party.id;
			testPartyIds.push(party.id);
		});

		it('should accept invitation successfully', async () => {
			const success = await acceptInvitation(testPartyId, players[1].id);
			expect(success).toBe(true);

			const partyPlayers = await getPartyPlayers(testPartyId);
			const acceptedPlayer = partyPlayers.find((p) => p.playerId === players[1].id);
			expect(acceptedPlayer!.joinedAt).not.toBeNull();
		});

		it('should return false for invalid party or player', async () => {
			const success = await acceptInvitation('invalid-party', players[1].id);
			expect(success).toBe(false);
		});
	});

	describe('invitePlayersToParty', () => {
		let testPartyId: string;

		beforeEach(async () => {
			const party = await createParty({
				title: 'Invite Test Party',
				minPlayers: 2,
				maxPlayers: 5,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: true, // Allow player invites
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id]
			});
			testPartyId = party.id;
			testPartyIds.push(party.id);
		});

		it('should allow creator to invite additional players', async () => {
			const success = await invitePlayersToParty(
				testPartyId,
				[players[2].id, players[3].id],
				players[0].id
			);
			expect(success).toBe(true);

			const partyPlayers = await getPartyPlayers(testPartyId);
			expect(partyPlayers).toHaveLength(4); // Creator + 3 invited
		});

		it('should allow invited players to invite others when allowPlayerInvites is true', async () => {
			// First accept the invitation so players[1] becomes a joined member
			await acceptInvitation(testPartyId, players[1].id);

			// Try to invite with the invited player (should succeed)
			const success = await invitePlayersToParty(
				testPartyId,
				[players[2].id],
				players[1].id // Using invited player as inviting player
			);
			expect(success).toBe(true);

			const partyPlayers = await getPartyPlayers(testPartyId);
			expect(partyPlayers).toHaveLength(3); // Creator + original invited + new invited
		});

		it('should prevent invites when allowPlayerInvites is false', async () => {
			// Create party with allowPlayerInvites = false using a different creator
			const restrictedParty = await createParty({
				title: 'Restricted Party',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[2].id,
				invitedPlayerIds: [players[1].id]
			});

			// First accept the invitation so players[1] becomes a joined member
			await acceptInvitation(restrictedParty.id, players[1].id);

			// Try to invite with a non-creator, non-admin player (should fail)
			const success = await invitePlayersToParty(
				restrictedParty.id,
				[players[3].id],
				players[1].id // Using invited player (not creator) as inviting player
			);
			expect(success).toBe(false);

			// Clean up
			await prisma.season.delete({ where: { id: restrictedParty.id } });
		});
	});

	describe('getJoinedPlayerCount', () => {
		let testPartyId: string;

		beforeEach(async () => {
			const party = await createParty({
				title: 'Count Test Party',
				minPlayers: 2,
				maxPlayers: 4,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id, players[2].id]
			});
			testPartyId = party.id;
			testPartyIds.push(party.id);
		});

		it('should return correct count of joined players', async () => {
			// Initially only creator is joined
			let count = await getJoinedPlayerCount(testPartyId);
			expect(count).toBe(1);

			// Accept one invitation
			await acceptInvitation(testPartyId, players[1].id);
			count = await getJoinedPlayerCount(testPartyId);
			expect(count).toBe(2);

			// Accept another invitation
			await acceptInvitation(testPartyId, players[2].id);
			count = await getJoinedPlayerCount(testPartyId);
			expect(count).toBe(3);
		});
	});

	describe('activateParty', () => {
		let testPartyId: string;

		beforeEach(async () => {
			const party = await createParty({
				title: 'Activation Test Party',
				minPlayers: 2,
				maxPlayers: 3,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id]
			});
			testPartyId = party.id;
			testPartyIds.push(party.id);
		});

		it('should activate party successfully', async () => {
			const success = await activateParty(testPartyId);
			expect(success).toBe(true);

			const party = await getPartyById(testPartyId);
			expect(party!.status).toBe('active');
		});

		it('should return false for non-existent party', async () => {
			const success = await activateParty('non-existent-id');
			expect(success).toBe(false);
		});
	});

	describe('checkPartyCompletion', () => {
		let testPartyId: string;

		beforeEach(async () => {
			const party = await createParty({
				title: 'Completion Test Party',
				minPlayers: 2,
				maxPlayers: 3,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id]
			});
			testPartyId = party.id;
			testPartyIds.push(party.id);
		});

		it('should not complete party when not active', async () => {
			// Party is still in 'open' status
			const wasCompleted = await checkPartyCompletion(testPartyId);
			expect(wasCompleted).toBe(false);

			const party = await getPartyById(testPartyId);
			expect(party!.status).toBe('open');
		});

		it('should not complete party when no games exist', async () => {
			// Activate party first
			await activateParty(testPartyId);

			const wasCompleted = await checkPartyCompletion(testPartyId);
			expect(wasCompleted).toBe(false);

			const party = await getPartyById(testPartyId);
			expect(party!.status).toBe('active');
		});

		it('should not complete party when games are not finished', async () => {
			// Activate party
			await activateParty(testPartyId);

			// Create a game but don't complete it
			const gameConfig = await prisma.gameConfig.create({
				data: {
					id: `test-config-${Date.now()}`,
					minTurns: 5,
					maxTurns: 10,
					writingTimeout: '7d',
					drawingTimeout: '7d',
					gameTimeout: '30d',
					isLewd: false
				}
			});

			await prisma.game.create({
				data: {
					id: `test-game-${Date.now()}-${Math.random()}`,
					seasonId: testPartyId,
					configId: gameConfig.id,
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					completedAt: null // Not completed
				}
			});

			const wasCompleted = await checkPartyCompletion(testPartyId);
			expect(wasCompleted).toBe(false);

			const party = await getPartyById(testPartyId);
			expect(party!.status).toBe('active');
		});

		it('should complete party when all games are finished', async () => {
			// Activate party
			await activateParty(testPartyId);

			// Create a completed game
			const gameConfig = await prisma.gameConfig.create({
				data: {
					id: `test-config-${Date.now()}-${Math.random()}`,
					minTurns: 5,
					maxTurns: 10,
					writingTimeout: '7d',
					drawingTimeout: '7d',
					gameTimeout: '30d',
					isLewd: false
				}
			});

			await prisma.game.create({
				data: {
					id: `test-game-${Date.now()}-${Math.random()}`,
					seasonId: testPartyId,
					configId: gameConfig.id,
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					completedAt: new Date() // Completed
				}
			});

			const wasCompleted = await checkPartyCompletion(testPartyId);
			expect(wasCompleted).toBe(true);

			const party = await getPartyById(testPartyId);
			expect(party!.status).toBe('completed');
		});

		it('should return false for non-existent party', async () => {
			const wasCompleted = await checkPartyCompletion('non-existent-id');
			expect(wasCompleted).toBe(false);
		});
	});

	describe('getCompletedPartyGames', () => {
		let testPartyId: string;

		beforeEach(async () => {
			const party = await createParty({
				title: 'Completed Games Test Party',
				minPlayers: 2,
				maxPlayers: 3,
				startDeadline: null,
				turnPassingAlgorithm: 'round-robin' as const,
				allowPlayerInvites: false,
				isLewd: false,
				creatorId: players[0].id,
				invitedPlayerIds: [players[1].id]
			});
			testPartyId = party.id;
			testPartyIds.push(party.id);
		});

		it('should return only completed games', async () => {
			// Create game configs
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

			// Create additional config for the incomplete game since configId must be unique
			const incompleteConfig = await prisma.gameConfig.create({
				data: {
					id: `test-config-incomplete-${testId}`,
					minTurns: 5,
					maxTurns: 10,
					writingTimeout: '7d',
					drawingTimeout: '7d',
					gameTimeout: '30d',
					isLewd: false
				}
			});

			// Create games: completed regular, completed lewd, and incomplete regular
			const completedRegularGame = await prisma.game.create({
				data: {
					id: `test-game-${Date.now()}-${Math.random()}-regular`,
					seasonId: testPartyId,
					configId: regularConfig.id,
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					completedAt: new Date()
				}
			});

			const completedLewdGame = await prisma.game.create({
				data: {
					id: `test-game-${Date.now()}-${Math.random()}-lewd`,
					seasonId: testPartyId,
					configId: lewdConfig.id,
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					completedAt: new Date()
				}
			});

			await prisma.game.create({
				data: {
					id: `test-game-${Date.now()}-${Math.random()}-incomplete`,
					seasonId: testPartyId,
					configId: incompleteConfig.id,
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
					completedAt: null // Not completed
				}
			});

			// Test: Get all completed games (include lewd)
			const allCompletedGames = await getCompletedPartyGames(testPartyId, true);
			expect(allCompletedGames).toHaveLength(2);
			expect(allCompletedGames.some((g) => g.id === completedRegularGame.id)).toBe(true);
			expect(allCompletedGames.some((g) => g.id === completedLewdGame.id)).toBe(true);

			// Test: Get only non-lewd completed games
			const nonLewdGames = await getCompletedPartyGames(testPartyId, false);
			expect(nonLewdGames).toHaveLength(1);
			expect(nonLewdGames[0].id).toBe(completedRegularGame.id);
		});

		it('should return empty array for party with no completed games', async () => {
			const completedGames = await getCompletedPartyGames(testPartyId, true);
			expect(completedGames).toHaveLength(0);
		});

		it('should return empty array for non-existent party', async () => {
			const completedGames = await getCompletedPartyGames('non-existent-id', true);
			expect(completedGames).toHaveLength(0);
		});
	});
});
