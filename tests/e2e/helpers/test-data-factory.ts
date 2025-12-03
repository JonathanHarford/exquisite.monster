import { prisma } from './prisma';
import type { Player, Game, Season, Turn } from '@prisma/client';
import { nanoid } from 'nanoid';

export interface TestData {
	player1: Player;
	player2: Player;
	game: Game;
	turn: Turn;
}

export async function createTestData(): Promise<TestData> {
	const testId = TestDataFactory.generateTestId();
	const uniqueSuffix = testId.slice(-8); // Use part of testId for uniqueness
	
	const player1 = await TestDataFactory.createTestPlayer(testId, { username: `testplayer1_${uniqueSuffix}` });
	const player2 = await TestDataFactory.createTestPlayer(testId, { username: `testplayer2_${uniqueSuffix}` });
	const game = await TestDataFactory.createTestGame(testId, [player1.id, player2.id]);
	const turn = await TestDataFactory.createTestTurn(testId, game.id, player1.id, { isComplete: true });

	return { player1, player2, game, turn };
}

export class TestDataFactory {
	private static testDataMap = new Map<string, string[]>();

	/**
	 * Generate a unique test ID for tracking test data
	 */
	static generateTestId(): string {
		return `test_${nanoid(7)}_${Date.now()}`;
	}

	/**
	 * Track created data for cleanup
	 */
	private static trackData(testId: string, entityId: string) {
		if (!this.testDataMap.has(testId)) {
			this.testDataMap.set(testId, []);
		}
		this.testDataMap.get(testId)!.push(entityId);
	}

	/**
	 * Manually track an entity ID for a test (for UI-created resources)
	 */
	static trackEntity(testId: string, entityId: string) {
		this.trackData(testId, entityId);
	}

	/**
	 * Get all currently tracked entities across all tests
	 */
	static getAllTrackedEntities(): string[] {
		const allEntities: string[] = [];
		for (const entityIds of this.testDataMap.values()) {
			allEntities.push(...entityIds);
		}
		return allEntities;
	}

	/**
	 * Create a test player with unique data
	 */
	static async createTestPlayer(testId: string, overrides?: Partial<Player>): Promise<Player> {
		const uniqueSuffix = nanoid(6);

		const player = await prisma.player.create({
			data: {
				id: overrides?.id || `test_player_${uniqueSuffix}`,
				username: overrides?.username || `testuser_${uniqueSuffix}`,
				imageUrl: overrides?.imageUrl || `https://example.com/avatar_${uniqueSuffix}.jpg`,
				isAdmin: overrides?.isAdmin || false,
				birthday: overrides?.birthday || new Date('1990-01-01'),
				...overrides
			}
		});

		this.trackData(testId, player.id);
		return player;
	}

	/**
	 * Create a test game with specific players
	 */
	static async createTestGame(
		testId: string,
		playerIds: string[],
		overrides?: Partial<Game> & { maxTurns?: number; isComplete?: boolean }
	): Promise<Game> {
		const gameId = overrides?.id || `test_game_${nanoid(9)}`;

		// Create config first - use gameId as configId to match real games
		const configId = gameId;
		const _gameConfig = await prisma.gameConfig.create({
			data: {
				id: configId,
				minTurns: 2,
				maxTurns: overrides?.maxTurns || 6,
				writingTimeout: '5m',
				drawingTimeout: '15m',
				gameTimeout: '1d',
				isLewd: false
			}
		});

		const game = await prisma.game.create({
			data: {
				id: gameId,
				configId,
				expiresAt: overrides?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
				completedAt: overrides?.isComplete ? new Date() : null,
				...overrides
			}
		});

		// Note: Players are connected to games through Turn records in this schema
		// No separate playersInGames table exists

		this.trackData(testId, game.id);
		return game;
	}

	/**
	 * Create a test season (party)
	 */
	static async createTestSeason(
		testId: string,
		playerIds: string[],
		overrides?: Partial<Season> & { name?: string; isActive?: boolean }
	): Promise<Season> {
		const seasonId = overrides?.id || `test_season_${nanoid(9)}`;

		// Create config first - use seasonId as configId to match real pattern
		const configId = seasonId;
		const _gameConfig = await prisma.gameConfig.create({
			data: {
				id: configId,
				minTurns: 2,
				maxTurns: 6,
				writingTimeout: '5m',
				drawingTimeout: '15m',
				gameTimeout: '1d',
				isLewd: false
			}
		});

		const season = await prisma.season.create({
			data: {
				id: seasonId,
				title: overrides?.name || `Test Season ${seasonId}`,
				createdBy: playerIds[0],
				gameConfigId: configId,
				status: overrides?.isActive ? 'active' : 'open',
				minPlayers: 2,
				maxPlayers: 10,
				...overrides
			}
		});

		// Add players to season
		for (const playerId of playerIds) {
			await prisma.playersInSeasons.create({
				data: {
					playerId,
					seasonId: season.id
				}
			});
		}

		this.trackData(testId, season.id);
		return season;
	}

	/**
	 * Create a complete test turn
	 */
	static async createTestTurn(
		testId: string,
		gameId: string,
		playerId: string,
		overrides?: {
			content?: string;
			svgData?: string;
			isComplete?: boolean;
			isDrawing?: boolean;
			orderIndex?: number;
		}
	) {
		const orderIndex = overrides?.orderIndex || 0;
		const turnId = `t_${gameId.slice(2)}_${orderIndex}`;
		
		const turn = await prisma.turn.create({
			data: {
				id: turnId,
				gameId,
				playerId,
				content: overrides?.content || 'Test turn content',
				isDrawing: overrides?.isDrawing || false,
				orderIndex,
				completedAt: overrides?.isComplete ? new Date() : null,
				expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
			}
		});

		this.trackData(testId, turn.id);
		return turn;
	}

	/**
	 * Setup common test scenario: 2 players with a game
	 */
	static async setupTwoPlayerGame(testId: string) {
		const uniqueSuffix = nanoid(6);
		const player1 = await this.createTestPlayer(testId, { username: `testplayer1_${uniqueSuffix}` });
		const player2 = await this.createTestPlayer(testId, { username: `testplayer2_${uniqueSuffix}` });
		const game = await this.createTestGame(testId, [player1.id, player2.id]);

		return { player1, player2, game };
	}

	/**
	 * Setup party scenario: season with multiple players
	 */
	static async setupPartyScenario(testId: string, playerCount = 3) {
		const uniqueSuffix = nanoid(6);
		const players = [];
		for (let i = 0; i < playerCount; i++) {
			players.push(await this.createTestPlayer(testId, { username: `partyplayer${i + 1}_${uniqueSuffix}` }));
		}

		const season = await this.createTestSeason(
			testId,
			players.map((p) => p.id)
		);
		const game = await this.createTestGame(
			testId,
			players.map((p) => p.id),
			{ seasonId: season.id }
		);

		return { players, season, game };
	}

	/**
	 * Clean up all data created for a specific test
	 */
	static async cleanup(testId: string) {
		const entityIds = this.testDataMap.get(testId) || [];

		// If no entities tracked, skip cleanup
		if (entityIds.length === 0) {
			this.testDataMap.delete(testId);
			return;
		}

		try {
			// Delete in dependency order to avoid foreign key conflicts
			await prisma.turnFlag.deleteMany({
				where: {
					turn: {
						gameId: { in: entityIds }
					}
				}
			});

			await prisma.comment.deleteMany({
				where: {
					OR: [
						{ gameId: { in: entityIds } },
						{ playerId: { in: entityIds } }
					]
				}
			});

			await prisma.gameFavorite.deleteMany({
				where: {
					OR: [
						{ gameId: { in: entityIds } },
						{ playerId: { in: entityIds } }
					]
				}
			});

			await prisma.turn.deleteMany({
				where: {
					OR: [
						{ id: { in: entityIds } },
						{ gameId: { in: entityIds } },
						{ playerId: { in: entityIds } }
					]
				}
			});

			// Note: Players are connected to games through Turn records, not a separate playersInGames table

			await prisma.playersInSeasons.deleteMany({
				where: {
					OR: [{ seasonId: { in: entityIds } }, { playerId: { in: entityIds } }]
				}
			});

			// Also clean up games that belong to tracked seasons (important for UI-created seasons)
			await prisma.game.deleteMany({
				where: { 
					OR: [
						{ id: { in: entityIds } },
						{ seasonId: { in: entityIds } } // Clean up games belonging to tracked seasons
					]
				}
			});

			await prisma.season.deleteMany({
				where: { id: { in: entityIds } }
			});

			await prisma.playerFavorite.deleteMany({
				where: {
					OR: [
						{ favoritingPlayerId: { in: entityIds } },
						{ favoritedPlayerId: { in: entityIds } }
					]
				}
			});

			await prisma.notification.deleteMany({
				where: { userId: { in: entityIds } }
			});

			await prisma.player.deleteMany({
				where: { id: { in: entityIds } }
			});

			await prisma.gameConfig.deleteMany({
				where: { id: { in: entityIds } }
			});
		} catch (error) {
			console.error(`Error cleaning up test data for ${testId}:`, error);
		} finally {
			this.testDataMap.delete(testId);
		}
	}

	/**
	 * Clean up all tracked test data
	 */
	static async cleanupAll() {
		const testIds = Array.from(this.testDataMap.keys());
		for (const testId of testIds) {
			await this.cleanup(testId);
		}
	}
}
