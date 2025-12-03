import type { Player, GameWithTurns, Turn } from '$lib/types/domain';

export interface SessionData {
	self: Player | null;
	unreadNotificationCount: number;
	activeGamesCount: number;
	pendingGame?: GameWithTurns;
	pendingTurn?: Turn;
	previousTurn?: Turn;
	pendingPartyTurnCount: number;
}
