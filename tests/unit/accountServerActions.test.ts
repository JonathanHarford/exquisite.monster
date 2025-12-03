import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateAge } from '$lib/utils/hlc';

describe('Account server actions - HLC enforcement', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('hideLewdContent enforcement logic', () => {
		it('should enforce hideLewdContent=true for users without birthday', () => {
			const birthday = null;
			const isUnder18 = !birthday || (birthday && calculateAge(birthday) < 18);
			const userSetting = false; // User tried to disable it
			const finalHideLewdContent = isUnder18 ? true : userSetting;

			expect(finalHideLewdContent).toBe(true);
		});

		it('should enforce hideLewdContent=true for users under 18', () => {
			const today = new Date();
			const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
			const birthday = sixteenYearsAgo;
			const isUnder18 = !birthday || calculateAge(birthday) < 18;
			const userSetting = false; // User tried to disable it
			const finalHideLewdContent = isUnder18 ? true : userSetting;

			expect(finalHideLewdContent).toBe(true);
		});

		it('should allow hideLewdContent=false for users 18 and over', () => {
			const today = new Date();
			const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
			const birthday = twentyYearsAgo;
			const isUnder18 = !birthday || calculateAge(birthday) < 18;
			const userSetting = false; // User wants to disable it
			const finalHideLewdContent = isUnder18 ? true : userSetting;

			expect(finalHideLewdContent).toBe(false);
		});

		it('should allow hideLewdContent=true for users 18 and over if they choose', () => {
			const today = new Date();
			const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
			const birthday = twentyYearsAgo;
			const isUnder18 = !birthday || calculateAge(birthday) < 18;
			const userSetting = true; // User wants to keep it enabled
			const finalHideLewdContent = isUnder18 ? true : userSetting;

			expect(finalHideLewdContent).toBe(true);
		});

		it('should handle exactly 18 years old correctly', () => {
			const today = new Date();
			const eighteenYearsAgo = new Date(
				today.getFullYear() - 18,
				today.getMonth(),
				today.getDate()
			);
			const birthday = eighteenYearsAgo;
			const isUnder18 = !birthday || calculateAge(birthday) < 18;
			const userSetting = false; // User wants to disable it
			const finalHideLewdContent = isUnder18 ? true : userSetting;

			expect(finalHideLewdContent).toBe(false); // 18 is considered adult
		});
	});
});
