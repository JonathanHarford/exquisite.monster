import type { Player } from '$lib/types/domain';

/**
 * Determines if a player is restricted to Hide Lewd Content (HLC) mode
 * Players are HLC if they:
 * - Haven't provided a birthday
 * - Are under 18 years old
 * - Have hideLewdContent enabled (default true)
 */
export function isHLCPlayer(player: Player): boolean {
	// No birthday provided
	if (!player.birthday) {
		return true;
	}

	// Under 18 years old
	const age = calculateAge(player.birthday);
	if (age < 18) {
		return true;
	}

	// Has hideLewdContent enabled
	return player.hideLewdContent;
}

/**
 * Calculates age from birthday
 */
export function calculateAge(birthday: Date): number {
	const today = new Date();
	const birthDate = new Date(birthday);
	let age = today.getFullYear() - birthDate.getFullYear();
	const monthDiff = today.getMonth() - birthDate.getMonth();

	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}

	return age;
}

/**
 * Determines if a player can view uncensored content
 */
export function canViewUncensoredContent(player: Player): boolean {
	return !isHLCPlayer(player);
}

/**
 * Determines if a player can create uncensored games
 */
export function canCreateUncensoredGame(player: Player): boolean {
	return !isHLCPlayer(player);
}
