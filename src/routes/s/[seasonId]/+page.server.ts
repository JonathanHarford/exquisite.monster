import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { PartyUseCases } from '$lib/server/usecases/PartyUseCases';
import { findPlayerById } from '$lib/server/services/playerService';
import type { GameWithTurns } from '$lib/types/domain';

export const load = (async ({ params, parent }) => {
	const { self } = await parent();
	if (!self) {
		throw error(401, 'Not authenticated');
	}

	const seasonId = params.seasonId;
	if (!seasonId) {
		throw error(404, 'Party not found');
	}

	try {
		const { party, seasonPlayers, players, games } = await PartyUseCases.getPartyDetails(seasonId);

		if (!party) {
			throw error(404, 'Party not found');
		}

		// Get creator information
		const creator = await findPlayerById(party.createdBy);
		const creatorUsername = creator?.username || 'Unknown Creator';

		// Check if current user is part of this party
		const currentUserPlayer = seasonPlayers.find((p) => p.playerId === self.id);
		const isParticipant = !!currentUserPlayer;
		const hasAccepted = currentUserPlayer?.joinedAt !== null;

		// Check if user is creator or admin
		const isCreator = party.createdBy === self.id;
		const isAdmin = self.isAdmin;

		// Access control: only allow access to invited players, creators, or admins
		if (!isParticipant && !isCreator && !isAdmin) {
			throw error(403, 'You are not invited to this party');
		}

		// Get completed games for finished parties
		let completedGames: GameWithTurns[] = [];
		if (party.status === 'completed') {
			const hideLewdContent = await PartyUseCases.getPlayerLewdContentPreference(self.id);
			completedGames = await PartyUseCases.getCompletedGamesForParty(seasonId, hideLewdContent);
		}

		// Get favorite players for invite functionality (only if user can invite and party is open)
		let favoritePlayersResult: Array<{ id: string; username: string; imageUrl: string }> = [];
		if (party.status === 'open' && (isCreator || isAdmin || party.allowPlayerInvites)) {
			favoritePlayersResult = await PartyUseCases.getFavoritePlayersForInvite(self.id);
		}

		return {
			party,
			seasonPlayers,
			players,
			games,
			completedGames,
			favoritePlayersResult,
			isParticipant,
			hasAccepted,
			isCreator,
			isAdmin,
			self,
			creatorUsername
		};
	} catch (err) {
		logger.error('Failed to load party details', err);
		throw error(500, 'Failed to load party');
	}
}) satisfies PageServerLoad;

export const actions = {
	acceptInvitation: async ({ params, locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const seasonId = params.seasonId;
		if (!seasonId) {
			return fail(400, { error: 'Invalid party ID' });
		}

		try {
			const success = await PartyUseCases.acceptPartyInvitation(seasonId, userId);
			if (!success) {
				return fail(400, { error: 'Failed to accept invitation' });
			}

			return { success: true };
		} catch (error) {
			logger.error('Failed to accept party invitation', error);
			return fail(500, { error: 'Failed to accept invitation' });
		}
	},

	adminJoinPlayer: async ({ request, params, locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const seasonId = params.seasonId;
		if (!seasonId) {
			return fail(400, { error: 'Invalid party ID' });
		}

		const formData = await request.formData();
		const playerId = formData.get('playerId')?.toString();

		if (!playerId) {
			return fail(400, { error: 'Player ID is required' });
		}

		try {
			const success = await PartyUseCases.adminJoinPlayerToParty(seasonId, playerId, userId);
			if (!success) {
				return fail(400, { error: 'Failed to join player to party' });
			}

			return { success: true };
		} catch (error) {
			logger.error('Failed to admin join player to party', error);
			return fail(500, { error: 'Failed to join player to party' });
		}
	},

	invitePlayers: async ({ request, params, locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const seasonId = params.seasonId;
		if (!seasonId) {
			return fail(400, { error: 'Invalid party ID' });
		}

		const formData = await request.formData();
		const playerIds = formData.getAll('playerIds') as string[];

		if (!playerIds.length) {
			return fail(400, { error: 'No players selected' });
		}

		try {
			const success = await PartyUseCases.invitePlayersToExistingParty(seasonId, playerIds, userId);
			if (!success) {
				return fail(400, { error: 'Failed to invite players' });
			}

			return { success: true };
		} catch (error) {
			logger.error('Failed to invite players to party', error);
			return fail(500, { error: 'Failed to invite players' });
		}
	},

	updatePartySettings: async ({ request, params, locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const seasonId = params.seasonId;
		if (!seasonId) {
			return fail(400, { error: 'Invalid party ID' });
		}

		const formData = await request.formData();
		const title = formData.get('title')?.toString();
		const minPlayers = parseInt(formData.get('minPlayers')?.toString() || '2');
		const maxPlayers = parseInt(formData.get('maxPlayers')?.toString() || '20');
		const startDeadline = formData.get('startDeadline')?.toString();
		const allowPlayerInvites = formData.get('allowPlayerInvites') === 'true';
		const turnPassingAlgorithm = formData.get('turnPassingAlgorithm')?.toString() || 'algorithmic';

		if (!title || title.trim().length === 0) {
			return fail(400, { error: 'Party title is required' });
		}

		if (minPlayers < 2 || maxPlayers < minPlayers || maxPlayers > 50) {
			return fail(400, { error: 'Invalid player limits' });
		}

		try {
			const success = await PartyUseCases.updatePartySettings(seasonId, userId, {
				title: title.trim(),
				minPlayers,
				maxPlayers,
				startDeadline: startDeadline ? new Date(startDeadline) : null,
				allowPlayerInvites,
				turnPassingAlgorithm: turnPassingAlgorithm as 'round-robin' | 'algorithmic'
			});

			if (!success) {
				return fail(400, { error: 'Failed to update party settings' });
			}

			return { success: true };
		} catch (error) {
			logger.error('Failed to update party settings', error);
			return fail(500, { error: 'Failed to update settings' });
		}
	},

	forceStartParty: async ({ params, locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const seasonId = params.seasonId;
		if (!seasonId) {
			return fail(400, { error: 'Invalid party ID' });
		}

		try {
			const success = await PartyUseCases.forceStartParty(seasonId, userId);
			if (!success) {
				return fail(400, { error: 'Failed to start party' });
			}

			return { success: true };
		} catch (error) {
			logger.error('Failed to force start party', error);
			return fail(500, { error: 'Failed to start party' });
		}
	},

	cancelParty: async ({ params, locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		const seasonId = params.seasonId;
		if (!seasonId) {
			return fail(400, { error: 'Invalid party ID' });
		}

		try {
			const success = await PartyUseCases.cancelParty(seasonId, userId);
			if (!success) {
				return fail(400, { error: 'Failed to cancel party' });
			}

			// Redirect to home page after successful cancellation
			redirect(302, '/');
		} catch (error) {
			logger.error('Failed to cancel party', error);
			return fail(500, { error: 'Failed to cancel party' });
		}
	}
} satisfies Actions;
