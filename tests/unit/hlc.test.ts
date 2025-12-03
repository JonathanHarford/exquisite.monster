import { describe, it, expect } from 'vitest';
import {
	isHLCPlayer,
	calculateAge,
	canViewUncensoredContent,
	canCreateUncensoredGame
} from '$lib/utils/hlc';
import type { Player } from '$lib/types/domain';

describe('HLC (Hide Lewd Content) utilities', () => {
	const createPlayer = (overrides: Partial<Player> = {}): Player => ({
		id: 'test-id',
		createdAt: new Date(),
		updatedAt: new Date(),
		username: 'testuser',
		imageUrl: 'https://example.com/image.jpg',
		aboutMe: '',
		websiteUrl: '',
		birthday: null,
		hideLewdContent: true,
		isAdmin: false,
		bannedAt: null,
		...overrides
	});

	describe('calculateAge', () => {
		it('should calculate age correctly', () => {
			const today = new Date();
			const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());

			expect(calculateAge(twentyYearsAgo)).toBe(20);
		});

		it('should handle birthday this year but not yet occurred', () => {
			const today = new Date();
			const birthdayThisYear = new Date(
				today.getFullYear() - 1,
				today.getMonth() + 1,
				today.getDate()
			);

			expect(calculateAge(birthdayThisYear)).toBe(0);
		});

		it('should handle birthday that occurred earlier this year', () => {
			const today = new Date();
			const birthdayEarlierThisYear = new Date(
				today.getFullYear() - 25,
				today.getMonth() - 1,
				today.getDate()
			);

			expect(calculateAge(birthdayEarlierThisYear)).toBe(25);
		});
	});

	describe('isHLCPlayer', () => {
		it('should return true for player with no birthday', () => {
			const player = createPlayer({ birthday: null });
			expect(isHLCPlayer(player)).toBe(true);
		});

		it('should return true for player under 18 regardless of hideLewdContent setting', () => {
			const today = new Date();
			const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());

			// Even if hideLewdContent is false, minors should still be HLC
			const player = createPlayer({ birthday: sixteenYearsAgo, hideLewdContent: false });
			expect(isHLCPlayer(player)).toBe(true);

			// Also test with hideLewdContent true
			const player2 = createPlayer({ birthday: sixteenYearsAgo, hideLewdContent: true });
			expect(isHLCPlayer(player2)).toBe(true);
		});

		it('should return true for player over 18 with hideLewdContent enabled', () => {
			const today = new Date();
			const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
			const player = createPlayer({ birthday: twentyYearsAgo, hideLewdContent: true });

			expect(isHLCPlayer(player)).toBe(true);
		});

		it('should return false for player over 18 with hideLewdContent disabled', () => {
			const today = new Date();
			const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
			const player = createPlayer({ birthday: twentyYearsAgo, hideLewdContent: false });

			expect(isHLCPlayer(player)).toBe(false);
		});

		it('should return true for player exactly 18 with hideLewdContent enabled', () => {
			const today = new Date();
			const eighteenYearsAgo = new Date(
				today.getFullYear() - 18,
				today.getMonth(),
				today.getDate()
			);
			const player = createPlayer({ birthday: eighteenYearsAgo, hideLewdContent: true });

			expect(isHLCPlayer(player)).toBe(true);
		});

		it('should return false for player exactly 18 with hideLewdContent disabled', () => {
			const today = new Date();
			const eighteenYearsAgo = new Date(
				today.getFullYear() - 18,
				today.getMonth(),
				today.getDate()
			);
			const player = createPlayer({ birthday: eighteenYearsAgo, hideLewdContent: false });

			expect(isHLCPlayer(player)).toBe(false);
		});
	});

	describe('canViewUncensoredContent', () => {
		it('should return false for HLC players', () => {
			const player = createPlayer({ birthday: null });
			expect(canViewUncensoredContent(player)).toBe(false);
		});

		it('should return true for non-HLC players', () => {
			const today = new Date();
			const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
			const player = createPlayer({ birthday: twentyYearsAgo, hideLewdContent: false });

			expect(canViewUncensoredContent(player)).toBe(true);
		});
	});

	describe('canCreateUncensoredGame', () => {
		it('should return false for HLC players', () => {
			const player = createPlayer({ birthday: null });
			expect(canCreateUncensoredGame(player)).toBe(false);
		});

		it('should return true for non-HLC players', () => {
			const today = new Date();
			const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
			const player = createPlayer({ birthday: twentyYearsAgo, hideLewdContent: false });

			expect(canCreateUncensoredGame(player)).toBe(true);
		});
	});
});
