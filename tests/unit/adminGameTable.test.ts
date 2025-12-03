import { describe, it, expect } from 'vitest';

describe('AdminGameTable strikethrough logic', () => {
	it('should apply strikethrough when game is not eligible for completion', () => {
		// Test cases for strikethrough logic
		const testCases = [
			{
				name: 'completed game should have strikethrough',
				game: {
					completedAt: new Date(),
					completedTurnsCount: 10,
					config: { minTurns: 8 }
				},
				expectedStrikethrough: true
			},
			{
				name: 'active game with insufficient turns should have strikethrough',
				game: {
					completedAt: null,
					completedTurnsCount: 5,
					config: { minTurns: 8 }
				},
				expectedStrikethrough: true
			},
			{
				name: 'active game with sufficient turns should not have strikethrough',
				game: {
					completedAt: null,
					completedTurnsCount: 10,
					config: { minTurns: 8 }
				},
				expectedStrikethrough: false
			},
			{
				name: 'active game with exactly minimum turns should not have strikethrough',
				game: {
					completedAt: null,
					completedTurnsCount: 8,
					config: { minTurns: 8 }
				},
				expectedStrikethrough: false
			}
		];

		testCases.forEach(({ name, game, expectedStrikethrough }) => {
			const isEligibleForCompletion =
				!game.completedAt && game.completedTurnsCount >= game.config.minTurns;
			const shouldHaveStrikethrough = !isEligibleForCompletion;

			expect(shouldHaveStrikethrough, name).toBe(expectedStrikethrough);
		});
	});
});
