import { generateSquare } from '$lib/utils/williamsSquare';

export function stringToSeed(s: string): number {
	let hash = 0;
	for (let i = 0; i < s.length; i++) {
		const char = s.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return Math.abs(hash);
}

export interface TurnContext {
	gameId: string;
	seasonId?: string | null;
	completedTurnPlayerId: string;
	completedTurnOrderIndex: number;
}

export interface GameTurnInfo {
	id: string;
	turns: Array<{ playerId: string; isDrawing: boolean; completedAt: Date | null }>;
}

export function assignNextTurnRoundRobin(
	gameId: string,
	completedTurnPlayerId: string,
	playerIds: string[]
): { nextPlayerId: string | null; error?: string } {
	const currentPlayerIndex = playerIds.indexOf(completedTurnPlayerId);
	if (currentPlayerIndex === -1) {
		return { nextPlayerId: null, error: `Completed turn player not found in party players: ${completedTurnPlayerId}` };
	}

	const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
	const nextPlayerId = playerIds[nextPlayerIndex];

	return { nextPlayerId };
}

export function assignNextTurnAlgorithmic(
	game: TurnContext,
	playerIds: string[],
	allPartyGames: GameTurnInfo[]
): { nextPlayerId: string | null; error?: string; log?: string } {
	const n = playerIds.length;
	if (n <= 3 || n > 26) {
		// Williams Square constraints
		return assignNextTurnRoundRobin(game.gameId, game.completedTurnPlayerId, playerIds);
	}

	// game.seasonId is guaranteed to exist for party games if this is called correctly
	if (!game.seasonId) {
		return { nextPlayerId: null, error: 'Season ID is required for algorithmic assignment' };
	}

	const seed = stringToSeed(game.seasonId);
	let williamsSquare: string[][];
	try {
		williamsSquare = generateSquare(n, seed);
	} catch (e) {
		return { nextPlayerId: null, error: `Failed to generate Williams Square: ${e}` };
	}

	const playerToLetter = new Map<string, string>();
	const letterToPlayer = new Map<string, string>();
	for (let i = 0; i < n; i++) {
		const letter = String.fromCharCode(65 + i); // A, B, C...
		playerToLetter.set(playerIds[i], letter);
		letterToPlayer.set(letter, playerIds[i]);
	}

	// Determine the current game's row in the Williams Square
	// This assumes a consistent ordering of games within a party.
	// For simplicity, let's assume games are ordered by creation time,
	// and the first game corresponds to row 0, second to row 1, etc.
	// This will require fetching all games for the party and finding the index of the current game.
	const gameIndex = allPartyGames.findIndex((g) => g.id === game.gameId);
	if (gameIndex === -1) {
		// Fallback to round robin
		const rr = assignNextTurnRoundRobin(game.gameId, game.completedTurnPlayerId, playerIds);
		return { ...rr, log: `Current game ${game.gameId} not found in allPartyGames for Williams Square assignment. Falling back to round-robin.` };
	}

	const currentRow = williamsSquare[gameIndex];

	// Determine the current turn's column in the Williams Square
	// The completedTurn.orderIndex gives us the 0-based index of the turn within the game.
	const currentTurnColumn = game.completedTurnOrderIndex;

	const nextTurnColumn = currentTurnColumn + 1;

	// If we've reached the end of the row, the game is complete for this square.
	// This implies that the game should be marked as completed.
	// For now, if nextTurnColumn is out of bounds, we'll return null,
	// which will eventually lead to game completion logic.
	if (nextTurnColumn >= n) {
		return { nextPlayerId: null, log: `Game ${game.gameId} completed its Williams Square sequence.` };
	}

	const nextPlayerLetter = currentRow[nextTurnColumn];
	const nextPlayerId = letterToPlayer.get(nextPlayerLetter);

	if (!nextPlayerId) {
		const rr = assignNextTurnRoundRobin(game.gameId, game.completedTurnPlayerId, playerIds);
		return { ...rr, log: `Could not find player ID for letter ${nextPlayerLetter}. Falling back to round-robin.` };
	}

	return { nextPlayerId };
}
