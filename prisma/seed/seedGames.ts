import type { PrismaClient, GameConfig } from '@prisma/client';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { parseDuration } from '../../src/lib/datetime';

interface TurnData {
	orderIndex: number;
	playerId: string;
	content: string;
	isDrawing: boolean;
}

interface GameData {
	gameId: string;
	minTurns: number;
	maxTurns: number;
	writingTimeout: string;
	drawingTimeout: string;
	gameTimeout: string;
	isLewd?: boolean;
	turns: TurnData[];
}

interface GamesYaml {
	games: GameData[];
}

const parseGamesYAML = (yamlPath: string): GameData[] => {
	const yamlContent = readFileSync(yamlPath, 'utf-8');
	const data = yaml.load(yamlContent) as GamesYaml;

	return data.games;
};

export const seedGames = async (
	prisma: PrismaClient,
	config: GameConfig,
	getPlayerById: (playerId: string) => string
) => {
	console.log('🎮 Seeding games...');

	// Ensure the target directory exists for game images
	const targetDir = join(process.cwd(), 'static/img/turns');
	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true });
		console.log('Created static/img/turns/ directory');
	}

	// Load games from consolidated YAML
	const gamesYAMLPath = join(process.cwd(), 'prisma/seed/data/games.yaml');
	const gameConfigs = parseGamesYAML(gamesYAMLPath);

	// Check if example games already exist
	const existingGames = await prisma.game.count({
		where: {
			id: { in: gameConfigs.map((game) => `g_${game.gameId}`) }
		}
	});

	if (existingGames >= 5) {
		console.log('Example games already exist, skipping game creation.');
		return;
	}

	console.log(`Only ${existingGames} example games exist, proceeding with game creation.`);

	for (let gameIndex = 0; gameIndex < gameConfigs.length; gameIndex++) {
		const gameData = gameConfigs[gameIndex];
		const gameTurns = gameData.turns;

		console.log(
			`Creating example game ${gameIndex + 1}: ${gameData.gameId} (${gameTurns.length} turns)...`
		);

		const now = new Date();
		const gameId = `g_${gameData.gameId}`;

		// Create game config first (or update if exists)
		await prisma.gameConfig.upsert({
			where: { id: gameId },
			update: {
				minTurns: gameData.minTurns,
				maxTurns: gameTurns.length, // Use actual turn count as max
				writingTimeout: gameData.writingTimeout,
				drawingTimeout: gameData.drawingTimeout,
				gameTimeout: gameData.gameTimeout,
				isLewd: gameData.isLewd || false
			},
			create: {
				id: gameId,
				minTurns: gameData.minTurns,
				maxTurns: gameTurns.length, // Use actual turn count as max
				writingTimeout: gameData.writingTimeout,
				drawingTimeout: gameData.drawingTimeout,
				gameTimeout: gameData.gameTimeout,
				isLewd: gameData.isLewd || false
			}
		});

		// Create game with config reference (or update if exists)
		await prisma.game.upsert({
			where: { id: gameId },
			update: {
				expiresAt: new Date(now.valueOf() + parseDuration(config.gameTimeout)),
				completedAt: new Date() // Mark as completed
			},
			create: {
				id: gameId,
				configId: gameId,
				expiresAt: new Date(now.valueOf() + parseDuration(config.gameTimeout)),
				completedAt: new Date() // Mark as completed
			}
		});

		// Create turns for the game
		for (const turnData of gameTurns) {
			console.log(`Creating ${gameId} turn ${turnData.orderIndex}: ${turnData.content}`);
			const playerId = getPlayerById(turnData.playerId);

			const turnId = `t_${gameId}_${turnData.orderIndex}`;
			await prisma.turn.upsert({
				where: { id: turnId },
				update: {
					content: turnData.isDrawing ? `/img/x/${turnData.content}` : turnData.content,
					completedAt: new Date(
						now.valueOf() - (gameTurns.length - turnData.orderIndex) * 60 * 1000
					) // Stagger completion times
				},
				create: {
					id: turnId,
					gameId: gameId,
					playerId: playerId,
					content: turnData.isDrawing ? `/img/x/${turnData.content}` : turnData.content,
					isDrawing: turnData.isDrawing,
					orderIndex: turnData.orderIndex,
					completedAt: new Date(
						now.valueOf() - (gameTurns.length - turnData.orderIndex) * 60 * 1000
					) // Stagger completion times
				}
			});
		}

		console.log(
			`✅ Created example game ${gameIndex + 1} with ID: ${gameId} (${gameTurns.length} turns, completed)`
		);

		// Add a small delay to ensure different timestamps for each game
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	console.log('✅ All example games created successfully');
};
