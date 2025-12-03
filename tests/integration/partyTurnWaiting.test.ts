import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { type Player, type GameConfig } from '$lib/types/domain';
import { getPlayers, replaceDefaultConfig } from './helpers';
import { DAYS, MINUTES, formatDuration } from '$lib/datetime';

const testConfig = {
	minTurns: 2,
	maxTurns: 4,
	writingTimeout: formatDuration(5 * MINUTES),
	drawingTimeout: formatDuration(5 * MINUTES),
	gameTimeout: formatDuration(1 * DAYS),
	isLewd: false
};

describe('Party Turn Waiting Functionality', () => {
	let players: Player[] = [];
	let defaultConfig: GameConfig;

	beforeAll(async () => {
		const allUsers = await AdminUseCases.getPlayerList();
		players = await getPlayers(allUsers, 4); // Use all available test players
		defaultConfig = await replaceDefaultConfig(testConfig);
	});

	afterAll(async () => {
		await replaceDefaultConfig(defaultConfig);
	});

	it('should find pending party turns only', async () => {
		// Create a party
		const { PartyUseCases } = await import('$lib/server/usecases/PartyUseCases');
		const party = await PartyUseCases.openParty(players[0].id, {
			title: 'Test Party',
			minPlayers: 2,
			maxPlayers: 4,
			startDeadline: null,
			turnPassingAlgorithm: 'round-robin',
			allowPlayerInvites: false,
			isLewd: testConfig.isLewd,
			invitedPlayerIds: []
		});

		// Create a party game and turn
		const createdAt = new Date();
		const partyGame = await GameUseCases.createGame(testConfig, party.id, testConfig.isLewd, createdAt);
		const partyTurn = await GameUseCases.createTurn(players[0].id, partyGame);

		// Create a non-party game and turn
		const regularGame = await GameUseCases.createGame(testConfig);
		await GameUseCases.createTurn(players[0].id, regularGame);

		// Test the method
		const result = await GameUseCases.findAllPendingPartyTurnsByPlayerId(players[0].id);

		// Should only return the party turn
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(partyTurn.id);
		expect(result[0].completedAt).toBeNull();
	});

	it('should return empty array when no pending party turns exist', async () => {
		const result = await GameUseCases.findAllPendingPartyTurnsByPlayerId('nonexistent-player');
		expect(result).toHaveLength(0);
	});

	it('should order turns by creation date (stalest first)', async () => {
		// Create a party
		const { PartyUseCases } = await import('$lib/server/usecases/PartyUseCases');
		const party = await PartyUseCases.openParty(players[0].id, {
			title: 'Test Party 2',
			minPlayers: 2,
			maxPlayers: 4,
			startDeadline: null,
			turnPassingAlgorithm: 'round-robin',
			allowPlayerInvites: false,
			isLewd: testConfig.isLewd,
			invitedPlayerIds: []
		});

		// Create two party games with different creation times
		const createdAt1 = new Date();
		const game1 = await GameUseCases.createGame(testConfig, party.id, testConfig.isLewd, createdAt1);
		const turn1 = await GameUseCases.createTurn(players[0].id, game1);

		// Small delay to ensure different creation times
		await new Promise((resolve) => setTimeout(resolve, 10));

		const createdAt2 = new Date();
		const game2 = await GameUseCases.createGame(testConfig, party.id, testConfig.isLewd, createdAt2);
		const turn2 = await GameUseCases.createTurn(players[0].id, game2);

		const result = await GameUseCases.findAllPendingPartyTurnsByPlayerId(players[0].id);

		// Should return turns ordered by creation date (oldest first)
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe(turn1.id);
		expect(result[1].id).toBe(turn2.id);
		expect(new Date(result[0].createdAt).getTime()).toBeLessThan(
			new Date(result[1].createdAt).getTime()
		);
	});
});
