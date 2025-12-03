import * as playerService from '$lib/server/services/playerService';
import * as gameService from '$lib/server/services/gameService';
import { getFavoritedGames } from '$lib/server/services/gameFavoriteService';
import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms/server';
import { zod4 } from 'sveltekit-superforms/adapters';
import { favoriteSchema } from '$lib/formSchemata';
import { AdminUseCases } from '$lib/server/usecases/AdminUseCases';
import { prisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { clerkClient } from 'svelte-clerk/server';

// Helper function to fetch email from Clerk
const fetchPlayerEmail = async (playerId: string): Promise<string | null> => {
	try {
		const clerkUser = await clerkClient.users.getUser(playerId);
		return clerkUser.emailAddresses?.[0]?.emailAddress || null;
	} catch {
		return null; // Handle case where Clerk user might not exist
	}
};

export const load = (async ({ params, locals, url, parent }) => {
	const form = await superValidate(zod4(favoriteSchema));
	const { self } = await parent();
	const userId = locals.auth().userId || self?.id; // Belt & suspenders
	const player = await playerService.findPlayerByIdWithFavorites(params.playerId, userId);

	if (!player) {
		throw error(404, 'Player not found');
	}

	// Get current user for conditional rendering
	const isOwnProfile = userId === player.id;

	// Get pagination parameters
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = 10;
	const offset = (page - 1) * limit;

	const activeTab = url.searchParams.get('tab') || 'played-games';

	// Load data based on the active tab
	let tabData: Record<string, unknown> = {};

	if (activeTab === 'faved-games') {
		const favoritedGames = await getFavoritedGames(params.playerId);
		const paginatedFavoritedGames = favoritedGames.slice(offset, offset + limit);

		tabData = {
			games: paginatedFavoritedGames,
			total: favoritedGames.length,
			totalPages: Math.ceil(favoritedGames.length / limit)
		};
	} else if (activeTab === 'played-games') {
		const statusFilter = 'all';
		const gameHistory = await gameService.getVisiblePlayerGameHistory(
			params.playerId,
			userId || null,
			{
				limit,
				offset,
				statusFilter
			}
		);

		tabData = {
			games: gameHistory.games,
			total: gameHistory.total,
			totalPages: Math.ceil(gameHistory.total / limit)
		};
	} else if (activeTab === 'faved-players') {
		const favoritedPlayers = await playerService.getFavoritedPlayers(params.playerId);
		const paginatedFavoritedPlayers = favoritedPlayers.slice(offset, offset + limit);

		tabData = {
			players: paginatedFavoritedPlayers,
			total: favoritedPlayers.length,
			totalPages: Math.ceil(favoritedPlayers.length / limit)
		};
	}

	const returnPayload = {
		form,
		player,
		isOwnProfile,
		activeTab,
		currentPage: page,
		...tabData
	};

	if (self?.isAdmin) {
		const playerDetails = await AdminUseCases.getPlayerDetails(params.playerId);
		if (playerDetails) {
			const allGames = await AdminUseCases.getGameListWithAnalytics();
			const playerGames = allGames.filter((game) =>
				game.turns.some((turn) => turn.playerId === params.playerId)
			);
			const emailPromise = fetchPlayerEmail(params.playerId);

			return {
				...returnPayload,
				playerDetails,
				playerGames,
				emailPromise
			};
		}
	}

	return returnPayload;
}) satisfies PageServerLoad;

export const actions = {
	favoritePlayerAction: async ({ request, locals }) => {
		if (!locals.auth().userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const form = await superValidate(request, zod4(favoriteSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const { id, action } = form.data;

			if (action === 'favorite') {
				await playerService.favoritePlayer(locals.auth().userId, id);
			} else {
				await playerService.unfavoritePlayer(locals.auth().userId, id);
			}

			return { success: true, action };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Action failed'
			});
		}
	},
	toggleBan: async ({ request, locals }) => {
		const player = locals.auth().userId
			? await prisma.player.findUnique({
				where: { id: locals.auth().userId },
				select: { isAdmin: true }
			})
			: null;

		if (!player?.isAdmin) {
			error(403, 'Not authorized');
		}

		const data = await request.formData();
		const playerId = data.get('playerId')?.toString();

		if (!playerId) {
			return fail(400, { error: 'Player ID is required' });
		}

		const targetPlayer = await prisma.player.findUnique({
			where: { id: playerId }
		});

		if (!targetPlayer) {
			return fail(404, { error: 'Player not found' });
		}

		if (targetPlayer.isAdmin) {
			return fail(403, { error: 'Cannot ban administrators' });
		}

		const now = new Date();
		await prisma.player.update({
			where: { id: playerId },
			data: {
				bannedAt: targetPlayer.bannedAt ? null : now
			}
		});

		const action = targetPlayer.bannedAt ? 'unbanned' : 'banned';
		logger.info(`Admin ${locals.auth().userId} ${action} player ${playerId}`);

		return { success: true };
	},

	deletePlayer: async ({ request, locals }) => {
		const player = locals.auth().userId
			? await prisma.player.findUnique({
				where: { id: locals.auth().userId },
				select: { isAdmin: true }
			})
			: null;

		if (!player?.isAdmin) {
			error(403, 'Not authorized');
		}

		const data = await request.formData();
		const playerId = data.get('playerId')?.toString();

		if (!playerId) {
			return fail(400, { error: 'Player ID is required' });
		}

		try {
			const result = await AdminUseCases.deletePlayer(playerId);
			logger.info(`Admin ${locals.auth().userId} deleted player ${playerId} (${result.username})`);

			return { success: true, deleted: true, username: result.username };
		} catch (error) {
			logger.error(`Failed to delete player ${playerId}:`, error);

			if (error instanceof Error) {
				return fail(400, { error: error.message });
			}

			return fail(500, { error: 'Failed to delete player' });
		}
	}
} satisfies Actions;
