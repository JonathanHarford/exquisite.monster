import type { Actions, PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod4 } from 'sveltekit-superforms/adapters';
import { partyCreationSchema } from '$lib/formSchemata';
import { error, fail, redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { PartyUseCases } from '$lib/server/usecases/PartyUseCases';
import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import { generateInvitationUrl } from '$lib/utils/invitation';
import { PUBLIC_BASE_URL } from '$env/static/public';

export const load = (async ({ parent }) => {
	const { self } = await parent();
	if (!self) {
		throw error(401, 'Not authenticated');
	}

	// Check if user has pending party turns - prevent party creation
	const pendingPartyTurns = await GameUseCases.findAllPendingPartyTurnsByPlayerId(self.id);
	if (pendingPartyTurns.length > 0) {
		redirect(302, `/`);
	}

	// Allow multiple party creation (removed restriction)

	// Load the user's favorite players for invitation list
	const favoritePlayersResult = await PartyUseCases.getFavoritePlayersForInvite(self.id);

	// Check if user has enough friends to create a party
	// A party needs at least 2 players total, so user needs at least 1 favorite player
	const hasEnoughFriends = favoritePlayersResult.length >= 1;

	// Initialize form with suggested title
	const suggestedTitle = `${self.username}'s Party ${new Date().toLocaleDateString()}`;

	const form = await superValidate(
		{
			title: suggestedTitle,
			turnPassingAlgorithm: 'algorithmic' as const,
			allowPlayerInvites: true
		},
		zod4(partyCreationSchema)
	);

	// Get user's active parties to show them they're already in parties
	const activeParties = await PartyUseCases.getUserActiveParties(self.id);

	return {
		invitationUrl: generateInvitationUrl(PUBLIC_BASE_URL, self.id),
		form,
		self,
		favoritePlayersResult,
		hasEnoughFriends,
		activeParties
	};
}) satisfies PageServerLoad;

export const actions = {
	create: async ({ request, locals }) => {
		const userId = locals.auth().userId;
		if (!userId) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Check if user has pending party turns - prevent party creation
		const pendingPartyTurns = await GameUseCases.findAllPendingPartyTurnsByPlayerId(userId);
		if (pendingPartyTurns.length > 0) {
			// User has pending party turns, redirect to the stalest one
			redirect(302, `/play/${pendingPartyTurns[0].id}`);
		}

		const form = await superValidate(request, zod4(partyCreationSchema));

		if (!form.valid) {
			return fail(400, { form });
		}
		
		// Check if user has enough friends to create a party
		const favoritePlayersResult = await PartyUseCases.getFavoritePlayersForInvite(userId);
		if (favoritePlayersResult.length < 1) {
			return fail(400, {
				form,
				error: 'You need at least 1 favorite player to create a party. Visit player profiles and favorite them first.'
			});
		}

		let party;
		try {
			const partyData = {
				title: form.data.title,
				// NOTE: minPlayers, maxPlayers, and startDeadline are DEPRECATED for parties
				// Parties now activate automatically when players join without these constraints
				minPlayers: 2, // DEPRECATED - kept for backward compatibility only
				maxPlayers: 20, // DEPRECATED - kept for backward compatibility only
				startDeadline: null, // DEPRECATED - kept for backward compatibility only
				turnPassingAlgorithm: form.data.turnPassingAlgorithm || 'algorithmic',
				allowPlayerInvites: form.data.allowPlayerInvites,
				isLewd: false, // Will be set automatically based on all players' preferences when starting
				invitedPlayerIds: [] // No initial invites, they'll invite after creation
			};

			party = await PartyUseCases.openParty(userId, partyData);
		} catch (error) {
			logger.error('Failed to create party', error);

			return fail(500, {
				form,
				error: 'Failed to create party. Please try again.'
			});
		}

		// Redirect to the new party page (outside try/catch)
		redirect(302, `/s/${party.id}`);
	}
} satisfies Actions;
