import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	obfuscateUserId,
	deobfuscateUserId,
	generateInvitationUrl,
	extractInvitationParam,
	getInvitationData
} from '$lib/utils/invitation';

describe('Invitation Utilities', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('obfuscateUserId and deobfuscateUserId', () => {
		it('should obfuscate and deobfuscate user IDs correctly', () => {
			const testIds = ['user_123abc', 'user_2yQPtsw13L3crbnWSylu0edenhI', 'simple_id', 'a'];

			testIds.forEach((userId) => {
				const obfuscated = obfuscateUserId(userId);
				const deobfuscated = deobfuscateUserId(obfuscated);

				expect(deobfuscated).toBe(userId);
				expect(obfuscated).not.toBe(userId);
				expect(obfuscated).toMatch(/^[A-Za-z0-9_-]*$/);
			});
		});

		it('should handle invalid obfuscated IDs', () => {
			expect(deobfuscateUserId('')).toBeNull();
			expect(deobfuscateUserId('invalid!!!')).toBeNull();
			expect(deobfuscateUserId('@#$%')).toBeNull();
		});

		it('should produce URL-safe obfuscated IDs', () => {
			const userId = 'user_2yQPtsw13L3crbnWSylu0edenhI';
			const obfuscated = obfuscateUserId(userId);

			expect(obfuscated).not.toMatch(/[+/=]/);
			expect(obfuscated).toMatch(/^[A-Za-z0-9_-]*$/);
		});
	});

	describe('generateInvitationUrl', () => {
		it('should obfuscate user ID correctly first', () => {
			const userId = 'user_123abc';
			const obfuscated = obfuscateUserId(userId);

			expect(obfuscated).toBeTruthy();
			expect(obfuscated).not.toBe(userId);
			expect(obfuscated.length).toBeGreaterThan(0);
		});

		it('should generate proper invitation URLs', () => {
			const baseUrl = 'https://example.com';
			const userId = 'user_123abc';

			const urlString = generateInvitationUrl(baseUrl, userId);
			const url = new URL(urlString);
			const param = url.searchParams.get('i');

			expect(urlString).toContain('https://example.com');
			expect(param).toBeTruthy();
			expect(deobfuscateUserId(param!)).toBe(userId);
		});
	});

	describe('extractInvitationParam', () => {
		it('should extract invitation parameter from URL', () => {
			const baseUrl = 'https://example.com';
			const userId = 'user_123abc';
			const urlString = generateInvitationUrl(baseUrl, userId);
			const url = new URL(urlString);

			const param = extractInvitationParam(url);
			expect(param).toBeTruthy();
			expect(deobfuscateUserId(param!)).toBe(userId);
		});

		it('should return null if no invitation parameter', () => {
			const url = new URL('https://example.com?other=param');
			const result = extractInvitationParam(url);
			expect(result).toBeNull();
		});
	});

	describe('getInvitationData', () => {
		it('should create invitation data from valid obfuscated param', () => {
			const userId = 'user_123abc';
			const obfuscated = obfuscateUserId(userId);
			const invitationData = getInvitationData(obfuscated);

			expect(invitationData).toBeTruthy();
			expect(invitationData!.inviterId).toBe(userId);
			expect(invitationData!.timestamp).toBeTypeOf('number');
		});

		it('should return null for invalid obfuscated param', () => {
			const invalidParam = 'invalid!!!';
			const invitationData = getInvitationData(invalidParam);
			expect(invitationData).toBeNull();
		});
	});

	describe('End-to-end flow', () => {
		it('should work with realistic Clerk user IDs', () => {
			const userId = 'user_2yQPtsw13L3crbnWSylu0edenhI';
			const baseUrl = 'https://example.com/join';

			const urlString = generateInvitationUrl(baseUrl, userId);
			const url = new URL(urlString);
			const param = extractInvitationParam(url);

			expect(param).toBeTruthy();
			const data = getInvitationData(param!);

			expect(data).toBeTruthy();
			expect(data!.inviterId).toBe(userId);
		});

		it('should generate URLs that contain invitation codes', () => {
			const userId = 'user_test';
			const baseUrl = 'https://example.com';
			const url = generateInvitationUrl(baseUrl, userId);
			expect(url).toContain('?i=');
		});
	});
});
