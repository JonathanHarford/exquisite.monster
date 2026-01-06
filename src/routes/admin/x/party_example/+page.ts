import { DAYS } from '$lib/datetime';
import { assignNextTurnAlgorithmic } from '$lib/logic/turnAssignment';
import type { GameWithTurns, Player, Turn, GameConfig } from '$lib/types/domain';

const NUM_PLAYERS = 12;
const COMPLETED_GAMES = 8;

// Mock Data Generation
const createMockPlayer = (id: number): Player => {
	const letter = String.fromCharCode(64 + id); // A, B, C, D, E, F, G, H, I, J
	const usernames = [
		'Avaricious Alice',
		'Bold Bob',
		'Creative Charlie',
		'Daring Diana',
		'Eager Eddie',
		'Fearless Fred',
		'Grumpy Greg',
		'Happy Harriet',
		'Intrepid Ivan',
		'Jolly Jane'
	];
	return {
		id: `player-${letter}`,
		createdAt: new Date(),
		updatedAt: new Date(),
		username: usernames[id - 1] || `Player ${id}`,
		imageUrl: `https://i.pravatar.cc/150?u=player-${letter}`,
		aboutMe: `About player ${letter}`,
		websiteUrl: '',
		birthday: null,
		hideLewdContent: false,
		isAdmin: false,
		bannedAt: null
	};
};

const createMockGame = (id: number, seasonId: string, playerIds: string[]): GameWithTurns => {
	const gameLetter = String.fromCharCode(64 + id); // A, B, C, D, E
	const gameConfig: GameConfig = {
		minTurns: playerIds.length,
		maxTurns: playerIds.length,
		writingTimeout: '2d',
		drawingTimeout: '2d',
		gameTimeout: '365d',
		isLewd: false
	};

	return {
		id: `game-${gameLetter}`,
		createdAt: new Date(),
		updatedAt: new Date(),
		completedAt: null,
		deletedAt: null,
		expiresAt: new Date(Date.now() + DAYS * 7),
		completedCount: 0,
		favoritesCount: 0,
		config: gameConfig,
		seasonId: seasonId,
		isLewd: false,
		turns: []
	};
};

const createMockTurn = (
	id: number,
	gameId: string,
	playerId: string,
	orderIndex: number,
	isDrawing: boolean
): Turn => ({
	id: `turn-${gameId}-${id}`,
	createdAt: new Date(),
	updatedAt: new Date(),
	expiresAt: new Date(Date.now() + DAYS),
	completedAt: null,
	status: 'pending',
	gameId,
	playerId,
	content: '',
	isDrawing,
	orderIndex,
	rejectedAt: null,
	flags: []
});

const generateMockData = () => {
	const players: Player[] = Array.from({ length: NUM_PLAYERS }, (_, i) => createMockPlayer(i + 1));
	const playerIds = players.map((p) => p.id);

	const games: GameWithTurns[] = Array.from({ length: NUM_PLAYERS }, (_, i) =>
		createMockGame(i + 1, 'mock-season', playerIds)
	);

	// Create the first turn for each game
	games.forEach((game, i) => {
		const firstTurn = createMockTurn(1, game.id, playerIds[i], 0, false);
		game.turns.push(firstTurn);
	});

	return { players, games };
};

// Simulation Logic
const runSimulation = async (
	games: GameWithTurns[],
	playerIds: string[]
): Promise<{ games: GameWithTurns[]; simulationEndTime: Date }> => {
	let completedGames = 0;
	const partyStartTime = new Date();
	let currentSimulationTime = new Date(partyStartTime);

	// Set all initial turns to start at party start time
	games.forEach((game) => {
		game.turns.forEach((turn) => {
			turn.createdAt = new Date(partyStartTime);
		});
	});

	while (completedGames < COMPLETED_GAMES) {
		const pendingTurns = games
			.flatMap((g) => g.turns)
			.filter((t) => t.status === 'pending' && !t.completedAt);

		if (pendingTurns.length === 0) {
			break; // No more pending turns - will handle incomplete games after loop
		}

		// Select a random pending turn
		const randomTurnIndex = Math.floor(Math.random() * pendingTurns.length);
		const turnToComplete = pendingTurns[randomTurnIndex];
		const gameOfTurn = games.find((g) => g.id === turnToComplete.gameId)!;

		// Choose how much time passes before next completion: 1d, 5d, or 25d
		const durations = [1, 5, 25]; // days
		const randomDuration = durations[Math.floor(Math.random() * durations.length)];

		// Next completion happens after this duration from current simulation time
		const completionTime = new Date(currentSimulationTime.getTime() + randomDuration * DAYS);

		// Update simulation time to this completion time
		currentSimulationTime = new Date(completionTime);

		// Complete the turn
		turnToComplete.completedAt = completionTime;
		turnToComplete.status = 'completed';
		turnToComplete.content = turnToComplete.isDrawing ? '<svg>...</svg>' : 'Some text';
		gameOfTurn.completedCount++;

		// Check for game completion
		if (gameOfTurn.completedCount === playerIds.length) {
			gameOfTurn.completedAt = completionTime;
			completedGames++;
			continue; // Don't assign a new turn if the game is over
		}

		// Assign the next turn
		// Convert games to the format expected by the algorithmic method
		const allPartyGames = games.map((g) => ({
			id: g.id,
			turns: g.turns.map((t) => ({
				playerId: t.playerId,
				isDrawing: t.isDrawing,
				completedAt: t.completedAt
			}))
		}));

		const result = assignNextTurnAlgorithmic(
			{
				gameId: gameOfTurn.id,
				seasonId: gameOfTurn.seasonId,
				completedTurnPlayerId: turnToComplete.playerId,
				completedTurnOrderIndex: turnToComplete.orderIndex
			},
			playerIds,
			allPartyGames
		);

		if (!result.nextPlayerId) {
			// This should never happen with correct constraints - identify the issue
			const nextTurnIsDrawing = gameOfTurn.turns.filter((t) => t.completedAt).length % 2 === 1;
			const maxTurnsPerType = Math.floor((playerIds.length + 1) / 2);

			// Only analyze players who haven't played in this game yet
			const eligibleForAnalysis = playerIds.filter((playerId) => {
				const hasPlayedInGame = gameOfTurn.turns.some((t) => t.playerId === playerId);
				return !hasPlayedInGame;
			});

			const rejectedPlayers = eligibleForAnalysis
				.map((playerId) => {
					const playerTurns = allPartyGames.flatMap((g) =>
						g.turns.filter((t) => t.playerId === playerId)
					);
					const drawingTurns = playerTurns.filter((t) => t.isDrawing).length;
					const writingTurns = playerTurns.filter((t) => !t.isDrawing).length;

					const reasons = [];
					if (nextTurnIsDrawing && drawingTurns >= maxTurnsPerType)
						reasons.push(`too many drawing turns`);
					if (!nextTurnIsDrawing && writingTurns >= maxTurnsPerType)
						reasons.push(`too many writing turns`);

					return reasons.length > 0 ? { playerId, reasons } : null;
				})
				.filter(Boolean);

			console.warn(`Game ${gameOfTurn.id} has no valid players.`);
			rejectedPlayers.forEach((player) => {
				if (player) {
					console.warn(`${player.playerId}: ${player.reasons.join(', ')}`);
				}
			});
			// Continue without creating a new turn - this will end the simulation for this game
			continue;
		}

		const newTurnIsDrawing = !turnToComplete.isDrawing;
		const nextTurn = createMockTurn(
			gameOfTurn.turns.length + 1,
			gameOfTurn.id,
			result.nextPlayerId,
			gameOfTurn.turns.length,
			newTurnIsDrawing
		);
		// Next turn starts when previous turn completed
		nextTurn.createdAt = completionTime;
		nextTurn.expiresAt = new Date(completionTime.getTime() + DAYS);
		gameOfTurn.turns.push(nextTurn);
	}

	// The simulation may end with some games incomplete if the algorithmic constraints
	// prevent further valid assignments. This is expected behavior when the constraints
	// are tight and the random completion order creates situations where no valid
	// assignments remain for some games.

	return { games, simulationEndTime: currentSimulationTime };
};

// Generate interaction matrix showing following relationships
const generateInteractionMatrix = (games: GameWithTurns[], playerIds: string[]) => {
	// Initialize matrix: [follower][followed] = { writing: 0, drawing: 0 }
	const matrix: Record<string, Record<string, { writing: number; drawing: number }>> = {};

	playerIds.forEach((followerId) => {
		matrix[followerId] = {};
		playerIds.forEach((followedId) => {
			matrix[followerId][followedId] = { writing: 0, drawing: 0 };
		});
	});

	// Analyze all games for following relationships
	games.forEach((game) => {
		const completedTurns = game.turns
			.filter((t) => t.completedAt)
			.sort((a, b) => a.orderIndex - b.orderIndex);

		// Look at consecutive turn pairs
		for (let i = 1; i < completedTurns.length; i++) {
			const followedTurn = completedTurns[i - 1];
			const followerTurn = completedTurns[i];

			const followedPlayer = followedTurn.playerId;
			const followerPlayer = followerTurn.playerId;

			// Safety check: only count if both players are in our player list
			if (matrix[followerPlayer] && matrix[followerPlayer][followedPlayer]) {
				// Count the type of turn the follower did
				if (followerTurn.isDrawing) {
					matrix[followerPlayer][followedPlayer].drawing++;
				} else {
					matrix[followerPlayer][followedPlayer].writing++;
				}
			} else {
				console.warn(
					`Missing matrix entry for ${followerPlayer} -> ${followedPlayer}. Available players:`,
					playerIds
				);
			}
		}
	});

	return {
		playerIds,
		matrix
	};
};

export const load = async () => {
	const { players, games: initialGames } = generateMockData();
	const { games: simulatedGames, simulationEndTime } = await runSimulation(
		initialGames,
		players.map((p) => p.id)
	);

	// Check if party would be completed (all games have completedAt)
	const allGamesCompleted =
		simulatedGames.length > 0 && simulatedGames.every((game) => game.completedAt !== null);
	const partyStatus = allGamesCompleted ? 'completed' : 'active';

	// Generate interaction matrix
	const interactionMatrix = generateInteractionMatrix(
		simulatedGames,
		players.map((p) => p.id)
	);

	return {
		players,
		games: simulatedGames,
		simulationEndTime,
		partyStatus,
		completedGameCount: simulatedGames.filter((g) => g.completedAt).length,
		totalGameCount: simulatedGames.length,
		interactionMatrix
	};
};
