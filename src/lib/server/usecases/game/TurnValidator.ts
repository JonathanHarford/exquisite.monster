import { GameUseCases } from '$lib/server/usecases/GameUseCases';
import type { GameWithTurns, Turn } from '$lib/types/domain';

export type ValidationResult =
	| { success: true; game: GameWithTurns; turn: Turn }
	| {
			success: false;
			error: 'game_not_found' | 'turn_not_found' | 'not_your_turn' | 'turn_completed';
			game?: GameWithTurns;
			turn?: Turn;
	  };

export class TurnValidator {
	static async validate(userId: string, turnId: string): Promise<ValidationResult> {
		const game = await GameUseCases.findGameByTurnId(turnId);

		if (!game) {
			return { success: false, error: 'game_not_found' };
		}

		// findGameByTurnId filters out rejected turns in the game object, but we need to check if the turn exists
		const turn = game.turns.find((t) => t.id === turnId);

		if (!turn) {
			return { success: false, error: 'turn_not_found' };
		}

		if (turn.playerId !== userId) {
			return { success: false, error: 'not_your_turn', game, turn };
		}

		if (turn.status !== 'pending') {
			return { success: false, error: 'turn_completed', game, turn };
		}

		return { success: true, game, turn };
	}
}
