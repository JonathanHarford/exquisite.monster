import { redirect, fail } from '@sveltejs/kit';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { prisma } from '$lib/server/prisma';
import type { PageServerLoad, Actions } from './$types';
import { unzip } from 'unzipit';
import * as yaml from 'js-yaml';
import { uploadToCloud } from '$lib/server/storage';
import { parseDuration } from '$lib/datetime';

interface TurnData {
	orderIndex?: number;
	playerId: string;
	content: string;
	isDrawing: boolean;
	createdAt?: string;
	completedAt?: string;
}

interface GameData {
	gameId: string;
	minTurns: number;
	maxTurns: number;
	writingTimeout: string;
	drawingTimeout: string;
	gameTimeout: string;
	isLewd?: boolean;
	createdAt?: string;
	completedAt?: string;
	turns: TurnData[];
}

interface GamesYaml {
	rootId?: string;
	games: GameData[];
}

export const load: PageServerLoad = async ({ locals }) => {
	const player = locals.auth().userId
		? await prisma.player.findUnique({
			where: { id: locals.auth().userId },
			select: { isAdmin: true }
		})
		: null;

	if (!player?.isAdmin) {
		throw redirect(302, '/');
	}

	const gameList = await AdminUseCases.getGameListWithAnalytics();

	return {
		gameList
	};
};

export const actions: Actions = {
	importGames: async ({ request, locals }) => {
		const player = locals.auth().userId
			? await prisma.player.findUnique({
				where: { id: locals.auth().userId },
				select: { isAdmin: true }
			})
			: null;

		if (!player?.isAdmin) {
			return fail(403, { error: true, message: 'You are not authorized to perform this action' });
		}

		const data = await request.formData();
		const file = data.get('zipfile') as File;

		if (!file || file.size === 0) {
			return fail(400, { error: true, message: 'No file uploaded' });
		}

		try {
			const { entries } = await unzip(file);

			// Look for any YAML file in the zip
			const yamlFiles = Object.keys(entries).filter((filename) => {
				return (
					(!filename.startsWith('_') && filename.endsWith('.yaml')) || filename.endsWith('.yml')
				);
			});

			if (yamlFiles.length === 0) {
				return fail(400, {
					error: true,
					message:
						'No YAML file found in zip file. Please include a .yaml or .yml file containing game data.'
				});
			}

			if (yamlFiles.length > 1) {
				return fail(400, {
					error: true,
					message: `Multiple YAML files found: ${yamlFiles.join(', ')}. Please include only one YAML file.`
				});
			}

			const yamlFilename = yamlFiles[0];
			const yamlEntry = entries[yamlFilename];

			const gamesYamlEntry = yamlEntry;
			const gamesYamlText = await gamesYamlEntry.text();
			const gamesData = yaml.load(gamesYamlText) as GamesYaml;

			// Validate YAML structure
			if (!gamesData || typeof gamesData !== 'object') {
				return fail(400, {
					error: true,
					message: 'Invalid YAML structure: root must be an object'
				});
			}

			if (!gamesData.games) {
				return fail(400, {
					error: true,
					message: 'Invalid YAML structure: missing "games" property'
				});
			}

			if (!Array.isArray(gamesData.games)) {
				return fail(400, {
					error: true,
					message: 'Invalid YAML structure: "games" must be an array'
				});
			}

			if (gamesData.games.length === 0) {
				return fail(400, { error: true, message: 'No games found in YAML file' });
			}

			// Sanity check - validate images exist in zip
			for (const game of gamesData.games) {
				for (const turn of game.turns) {
					if (turn.isDrawing) {
						if (!entries[turn.content]) {
							return fail(400, {
								error: true,
								message: `Image ${turn.content} for game ${game.gameId} not found in zip file`
							});
						}
					}
				}
			}

			// Validate all player IDs exist in database before attempting import
			const allPlayerIds = new Set<string>();
			for (const game of gamesData.games) {
				for (const turn of game.turns) {
					allPlayerIds.add(turn.playerId);
				}
			}

			const existingPlayers = await prisma.player.findMany({
				where: { id: { in: Array.from(allPlayerIds) } },
				select: { id: true }
			});

			const existingPlayerIds = new Set(existingPlayers.map((p) => p.id));
			const missingPlayerIds = Array.from(allPlayerIds).filter((id) => !existingPlayerIds.has(id));

			if (missingPlayerIds.length > 0) {
				return fail(400, {
					error: true,
					message: `Cannot import games: the following player IDs do not exist in the database: ${missingPlayerIds.join(', ')}. Please ensure all players exist before importing games.`
				});
			}

			// Auto-generate root ID if not provided
			let rootIdInput = gamesData.rootId?.toString().trim();
			if (!rootIdInput) {
				// Generate a unique root ID using timestamp and random string
				const timestamp = Date.now().toString(36);
				const random = Math.random().toString(36).substr(2, 5);
				rootIdInput = `import_${timestamp}_${random}`;
			}

			for (const gameData of gamesData.games) {
				const gameTurns = gameData.turns;

				// Auto-generate individual game ID if blank or missing
				let gameIdInput = gameData.gameId?.toString().trim();
				if (!gameIdInput) {
					// Generate a unique ID using timestamp and random string
					const timestamp = Date.now().toString(36);
					const random = Math.random().toString(36).substr(2, 5);
					gameIdInput = `game_${timestamp}_${random}`;
				}

				// Combine rootId and gameId
				const gameId = `${rootIdInput}_${gameIdInput}`;
				console.log(gameId);
				// Check if game already exists
				const existingGame = await prisma.game.findUnique({
					where: { id: gameId }
				});

				if (existingGame) {
					return fail(400, {
						error: true,
						message: `Game with ID ${gameId} already exists. Please use a different rootId or gameId combination, or delete the existing game first.`
					});
				}
				const gameTimeout = gameData.gameTimeout || '24h';

				let gameConfigCreated = false;
				try {
					// Create GameConfig first
					await prisma.gameConfig.create({
						data: {
							id: gameId,
							minTurns: gameData.minTurns || gameTurns.length,
							maxTurns: gameData.maxTurns || gameTurns.length,
							writingTimeout: gameData.writingTimeout || '2m',
							drawingTimeout: gameData.drawingTimeout || '6m',
							gameTimeout,
							isLewd: gameData.isLewd || false
						}
					});
					gameConfigCreated = true;

					await prisma.game.create({
						data: {
							id: gameId,
							configId: gameId,
							expiresAt: new Date(Date.now() + parseDuration(gameTimeout))
						}
					});

					// Process turn timestamps - ensure both createdAt and completedAt are available
					const processedTurns = gameTurns.map((turnData, index) => {
						// If only one timestamp is provided, use it for both
						// If neither is provided, validation will catch this
						let createdAt = turnData.createdAt;
						let completedAt = turnData.completedAt;
						const orderIndex = turnData.orderIndex ?? index;

						if (!createdAt && !completedAt) {
							throw new Error(
								`Turn ${orderIndex} in game ${gameData.gameId} must have at least one of createdAt or completedAt`
							);
						}

						if (!createdAt) {
							createdAt = completedAt;
						}
						if (!completedAt) {
							completedAt = createdAt;
						}

						return {
							...turnData,
							orderIndex,
							createdAt: createdAt!,
							completedAt: completedAt!
						};
					});

					// Derive game timestamps from turns if not provided
					let gameCreatedAt = gameData.createdAt;
					let gameCompletedAt = gameData.completedAt;

					if (!gameCreatedAt) {
						// Use earliest turn createdAt
						const earliestTurn = processedTurns.reduce((earliest, turn) =>
							new Date(turn.createdAt) < new Date(earliest.createdAt) ? turn : earliest
						);
						gameCreatedAt = earliestTurn.createdAt;
					}

					if (!gameCompletedAt) {
						// Use latest turn completedAt
						const latestTurn = processedTurns.reduce((latest, turn) =>
							new Date(turn.completedAt) > new Date(latest.completedAt) ? turn : latest
						);
						gameCompletedAt = latestTurn.completedAt;
					}

					// Update game creation with derived timestamps
					await prisma.game.update({
						where: { id: gameId },
						data: {
							createdAt: new Date(gameCreatedAt),
							completedAt: new Date(gameCompletedAt)
						}
					});

					// Create all turns for this game
					for (const turnData of processedTurns) {
						let content = turnData.content;
						if (turnData.isDrawing) {
							const imageEntry = entries[turnData.content];
							const buffer = await imageEntry.arrayBuffer();

							// Determine MIME type from file extension
							let mimeType: string;
							const ext = turnData.content.toLowerCase().split('.').pop();
							switch (ext) {
								case 'png':
									mimeType = 'image/png';
									break;
								case 'jpg':
								case 'jpeg':
									mimeType = 'image/jpeg';
									break;
								case 'gif':
									mimeType = 'image/gif';
									break;
								case 'webp':
									mimeType = 'image/webp';
									break;
								default:
									mimeType = 'image/png'; // fallback
							}

							const { path } = await uploadToCloud(
								Buffer.from(buffer),
								turnData.content,
								'turns',
								mimeType
							);
							content = path;
						}

						await prisma.turn.create({
							data: {
								id: `t_${gameId}_${turnData.orderIndex}`,
								gameId: gameId,
								playerId: turnData.playerId,
								content: content,
								isDrawing: turnData.isDrawing,
								orderIndex: turnData.orderIndex,
								createdAt: new Date(turnData.createdAt),
								completedAt: new Date(turnData.completedAt)
							}
						});
					}
				} catch (gameImportError) {
					// If GameConfig was created but something else failed, clean it up
					if (gameConfigCreated) {
						try {
							await prisma.gameConfig.delete({
								where: { id: gameId }
							});
						} catch (deleteError) {
							console.error(`Failed to clean up GameConfig ${gameId}:`, deleteError);
						}
					}
					// Re-throw the original error
					throw gameImportError;
				}
			}

			return { success: true, message: 'Games imported successfully' };
		} catch (error) {
			console.error(error);
			const message = error instanceof Error ? error.message : 'An unknown error occurred';
			return fail(500, { error: true, message: `Failed to import games: ${message}` });
		}
	}
};
