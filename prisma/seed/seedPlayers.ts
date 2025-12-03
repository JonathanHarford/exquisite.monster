import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { humanId } from 'human-id';

interface PlayerData {
	id: string;
	username?: string;
	imageUrl: string;
	isAdmin: boolean;
	birthdate?: string;
	favorites?: string[];
	hideLewd?: boolean;
}

interface PlayersYaml {
	players: PlayerData[];
}

const parsePlayersYAML = (yamlPath: string): PlayerData[] => {
	const yamlContent = readFileSync(yamlPath, 'utf-8');
	const data = yaml.load(yamlContent) as PlayersYaml;

	return data.players;
};

export const generateUniqueUsername = async (prisma: PrismaClient): Promise<string> => {
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const username = humanId({ separator: ' ', capitalize: true });

		// Check if this username already exists
		const existingPlayer = await prisma.player.findUnique({
			where: { username }
		});

		if (!existingPlayer) {
			return username;
		}

		attempts++;
	}

	// If we can't find a unique username after maxAttempts, append a number
	const baseUsername = humanId({ separator: ' ', capitalize: true });
	const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
	return `${baseUsername} ${timestamp}`;
};

export const seedPlayers = async (prisma: PrismaClient) => {
	console.log('🧑‍🤝‍🧑 Seeding players...');

	// Load test players from YAML
	const yamlPath = join(process.cwd(), 'prisma/seed/data/players.yaml');
	const testPlayers = parsePlayersYAML(yamlPath);

	// Create test players
	for (const player of testPlayers) {
		const existingPlayer = await prisma.player.findUnique({
			where: { id: player.id }
		});

		if (existingPlayer) {
			console.log(`Player ${existingPlayer.username} already exists with ID: ${existingPlayer.id}`);
			// Update the testPlayers array to use the existing player's data
			const playerIndex = testPlayers.findIndex((p) => p.id === player.id);
			if (playerIndex !== -1) {
				testPlayers[playerIndex] = {
					...testPlayers[playerIndex],
					id: existingPlayer.id,
					username: existingPlayer.username
				};
			}
		} else {
			// Generate username if not provided
			const username = player.username || (await generateUniqueUsername(prisma));

			// Create the player if it doesn't exist
			await prisma.player.create({
				data: {
					id: player.id,
					username,
					imageUrl: player.imageUrl,
					isAdmin: player.isAdmin,
					birthday: player.birthdate ? new Date(player.birthdate) : null,
					hideLewdContent: player.hideLewd !== undefined ? player.hideLewd : true
				}
			});
			console.log(`Created player ${username} with ID: ${player.id}`);
		}
	}

	// Create favorite relationships after all players are created
	for (const player of testPlayers) {
		if (player.favorites && player.favorites.length > 0) {
			for (const favoriteId of player.favorites) {
				// Check if the favorite relationship already exists
				const existingFavorite = await prisma.playerFavorite.findUnique({
					where: {
						favoritingPlayerId_favoritedPlayerId: {
							favoritingPlayerId: player.id,
							favoritedPlayerId: favoriteId
						}
					}
				});

				if (!existingFavorite) {
					await prisma.playerFavorite.create({
						data: {
							favoritingPlayerId: player.id,
							favoritedPlayerId: favoriteId
						}
					});
					console.log(`Created favorite relationship: ${player.id} -> ${favoriteId}`);
				}
			}
		}
	}

	console.log('✅ Test players seeded successfully');
	return testPlayers;
};

export const getPlayerByUsername = (testPlayers: PlayerData[], username: string): string => {
	const player = testPlayers.find((p) => p.username === username);
	if (!player) {
		throw new Error(`Player not found: ${username}`);
	}
	return player.id;
};

export const getPlayerById = (testPlayers: PlayerData[], playerId: string): string => {
	const player = testPlayers.find((p) => p.id === playerId);
	if (!player) {
		throw new Error(`Player not found with ID: ${playerId}`);
	}
	return player.id;
};
