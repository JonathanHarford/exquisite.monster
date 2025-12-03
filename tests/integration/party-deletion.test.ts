import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import { PartyUseCases } from '$lib/server/usecases/PartyUseCases';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';

describe('Party Cascade Deletion', () => {
	let testAdminId: string;
	let testCreatorId: string;
	let testPlayerId: string;
	let seasonId: string;
	let gameId: string;

	beforeEach(async () => {
		// Create test players
		testAdminId = 'test_admin_user_cascade_delete';
		testCreatorId = 'test_creator_user_cascade_delete';
		testPlayerId = 'test_player_user_cascade_delete';

		await prisma.player.createMany({
			data: [
				{
					id: testAdminId,
					username: 'test-admin-cascade-delete',
					imageUrl: 'https://example.com/admin.jpg',
					isAdmin: true
				},
				{
					id: testCreatorId,
					username: 'test-creator-cascade-delete',
					imageUrl: 'https://example.com/creator.jpg',
					isAdmin: false
				},
				{
					id: testPlayerId,
					username: 'test-player-cascade-delete',
					imageUrl: 'https://example.com/player.jpg',
					isAdmin: false
				}
			],
			skipDuplicates: true
		});

		// Create a party with games and turns
		const party = await PartyUseCases.openParty(testCreatorId, {
			title: 'Test Party for Cascade Delete',
			minPlayers: 2,
			maxPlayers: 3,
			startDeadline: null,
			turnPassingAlgorithm: 'round-robin',
			allowPlayerInvites: true,
			isLewd: false,
			invitedPlayerIds: [testPlayerId]
		});

		seasonId = party.id;

		// Accept invitation and start party
		await PartyUseCases.acceptPartyInvitation(seasonId, testPlayerId);
		await PartyUseCases.startParty(seasonId, testCreatorId);

		// Get the created game
		const { games } = await PartyUseCases.getPartyDetails(seasonId);
		expect(games.length).toBeGreaterThan(0);
		gameId = games[0].id;

		// Complete the first turn and create a second turn
		const firstTurn = games[0].turns[0];
		await GameUseCases.completeTurn(firstTurn.id, 'writing', 'Test writing content');

		// Get the second turn that should have been created
		const updatedGame = await GameUseCases.findGameByIdAdmin(gameId);
		expect(updatedGame?.turns.length).toBeGreaterThan(1);
	});

	afterEach(async () => {
		// Clean up test data
		await prisma.playersInSeasons.deleteMany({
			where: {
				playerId: { in: [testAdminId, testCreatorId, testPlayerId] }
			}
		});
		await prisma.player.deleteMany({
			where: {
				id: { in: [testAdminId, testCreatorId, testPlayerId] }
			}
		});
	});

	it('should cascade delete games and turns when season is deleted', async () => {
		// Verify data exists before deletion
		const partyBefore = await prisma.season.findUnique({ where: { id: seasonId } });
		const gamesBefore = await prisma.game.findMany({ where: { seasonId } });
		const turnsBefore = await prisma.turn.findMany({ where: { gameId } });
		const playerMembershipsBefore = await prisma.playersInSeasons.findMany({
			where: { seasonId }
		});

		expect(partyBefore).toBeTruthy();
		expect(gamesBefore.length).toBeGreaterThan(0);
		expect(turnsBefore.length).toBeGreaterThan(0);
		expect(playerMembershipsBefore.length).toBeGreaterThan(0);

		// Cancel the party (which now does full deletion)
		const cancelResult = await PartyUseCases.cancelParty(seasonId, testAdminId);
		expect(cancelResult).toBe(true);

		// Verify party is hard deleted but games are soft deleted
		const partyAfter = await prisma.season.findUnique({ where: { id: seasonId } });
		const gameAfterSoftDeleted = await prisma.game.findUnique({ 
			where: { id: gameId } 
		});
		const completedTurnsAfter = await prisma.turn.findMany({ 
			where: { gameId, completedAt: { not: null } } 
		});
		const pendingTurnsAfter = await prisma.turn.findMany({ 
			where: { gameId, completedAt: null, rejectedAt: null } 
		});
		const playerMembershipsAfter = await prisma.playersInSeasons.findMany({
			where: { seasonId }
		});

		// Party should be hard deleted (null)
		expect(partyAfter).toBeNull();
		
		// Game should be soft deleted (still exist but with deletedAt set and no seasonId)
		expect(gameAfterSoftDeleted).toBeTruthy();
		expect(gameAfterSoftDeleted?.deletedAt).toBeTruthy();
		expect(gameAfterSoftDeleted?.seasonId).toBeNull();
		
		// Completed turns should still exist
		expect(completedTurnsAfter.length).toBeGreaterThan(0);
		
		// Pending turns should be hard deleted
		expect(pendingTurnsAfter.length).toBe(0);
		
		// Player memberships should be cascade deleted with party
		expect(playerMembershipsAfter.length).toBe(0);
	});

	it('should allow creators to cancel parties', async () => {
		// Try to cancel with creator (should now work)
		const cancelResult = await PartyUseCases.cancelParty(seasonId, testCreatorId);
		expect(cancelResult).toBe(true);

		// Verify party is deleted (creators can now cancel)
		const party = await prisma.season.findUnique({ where: { id: seasonId } });
		expect(party).toBeNull();
	});

	it('should return false when trying to cancel non-existent party', async () => {
		const fakeSeasonId = 'fake_season_id';
		const cancelResult = await PartyUseCases.cancelParty(fakeSeasonId, testAdminId);
		expect(cancelResult).toBe(false);
	});

	it('should send cancellation notifications to all party members', async () => {
		// Clear existing notifications
		await prisma.notification.deleteMany({
			where: {
				userId: { in: [testCreatorId, testPlayerId] }
			}
		});

		// Verify party members exist before deletion
		const partyMembers = await prisma.playersInSeasons.findMany({
			where: { seasonId }
		});
		expect(partyMembers.length).toBe(2); // Creator and invited player

		// Cancel the party (which now does full deletion)
		const cancelResult = await PartyUseCases.cancelParty(seasonId, testAdminId);
		expect(cancelResult).toBe(true);

		// Check that notifications were sent
		const notifications = await prisma.notification.findMany({
			where: {
				userId: { in: [testCreatorId, testPlayerId] },
				type: 'party_cancelled'
			}
		});

		expect(notifications.length).toBe(2); // One for creator, one for invited player
		
		const creatorNotification = notifications.find(n => n.userId === testCreatorId);
		const playerNotification = notifications.find(n => n.userId === testPlayerId);
		
		expect(creatorNotification).toBeTruthy();
		expect(playerNotification).toBeTruthy();
		expect(creatorNotification?.title).toBe('Party Cancelled');
		expect(creatorNotification?.body).toContain('Test Party for Cascade Delete');
	});
});