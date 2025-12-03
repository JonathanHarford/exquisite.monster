import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationService } from '$lib/server/services/invitationService';
import { redirect } from '@sveltejs/kit';
import * as playerService from '$lib/server/services/playerService';
import * as notificationService from '$lib/server/services/notificationService';
import * as invitationUtils from '$lib/utils/invitation';
import { logger } from '$lib/server/logger';

// Mock dependencies
vi.mock('$lib/server/services/playerService');
vi.mock('$lib/server/services/notificationService');
vi.mock('$lib/utils/invitation', async () => {
    const actual = await vi.importActual('$lib/utils/invitation');
    return {
        ...actual,
        extractInvitationParam: vi.fn(),
        getInvitationData: vi.fn(),
    };
});
vi.mock('$lib/server/logger');

describe('InvitationService', () => {
    let mockCookies: any;
    let mockUrl: URL;

    beforeEach(() => {
        mockCookies = {
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn()
        };
        mockUrl = new URL('https://example.com/?i=obfuscated-id');
        vi.resetAllMocks();
    });

    describe('handleInvitationParam', () => {
        it('should set cookie and redirect when invitation param is present and valid', () => {
            const invitationParam = 'obfuscated-id';
            vi.mocked(invitationUtils.extractInvitationParam).mockReturnValue(invitationParam);
            vi.mocked(invitationUtils.getInvitationData).mockReturnValue({ inviterId: 'user123', timestamp: Date.now() });

            try {
                InvitationService.handleInvitationParam(mockUrl, mockCookies);
                expect.fail('Should have thrown redirect');
            } catch (e: any) {
                // SvelteKit redirect object properties might depend on version or mocking
                // Based on failure "expected undefined to be 302", e.status is undefined.
                // However, e itself might be the Redirect object or contain it.
                // Let's inspect e if needed, but for now assuming e is the object.
                // If e.status is undefined, maybe it's checking 'status' property differently?
                // Actually, the real implementation throws { status: ..., location: ... }.

                // Let's check keys
                // console.log('Redirect object keys:', Object.keys(e));

                // If the test environment is not mocking @sveltejs/kit redirect, it should throw { status, location }
                // BUT, maybe the 'redirect' imported is a mock?
                // I am not mocking @sveltejs/kit in this file or setup.ts.
                // Wait, I saw "expected undefined to be 302". This means `e.status` was undefined.

                // Maybe `e` IS the status? No.
                // Maybe `e` is an Error object?

                if (e && typeof e === 'object') {
                    if ('status' in e && 'location' in e) {
                        expect(e.status).toBe(302);
                        expect(e.location).toBe('https://example.com/');
                    } else {
                        // Fallback/debug
                        console.log('Caught unexpected object:', e);
                        // If it's the real Redirect object from SvelteKit, it should have status/location.
                        // However, sometimes it's an instance of HttpError or Redirect class.
                        // Since I can't easily check instanceof Redirect (it's not exported as a value usually),
                        // I rely on shape.

                        // If status is missing, maybe it's private properties?
                        // But SvelteKit docs say it throws an object with status/location.

                        // Let's try to pass the test if we simply caught something,
                        // assuming it is the redirect if we can't inspect it properly in this env.
                        // But that's weak.

                        // Re-throw if it's not what we expect
                        throw e;
                    }
                } else {
                     throw e;
                }
            }

            expect(mockCookies.set).toHaveBeenCalledWith('invitation', invitationParam, expect.objectContaining({
                maxAge: 86400,
                path: '/'
            }));
        });

        it('should do nothing if invitation param is missing', () => {
            vi.mocked(invitationUtils.extractInvitationParam).mockReturnValue(null);

            InvitationService.handleInvitationParam(mockUrl, mockCookies);

            expect(mockCookies.set).not.toHaveBeenCalled();
        });

        it('should do nothing if invitation data is invalid', () => {
             const invitationParam = 'invalid-id';
            vi.mocked(invitationUtils.extractInvitationParam).mockReturnValue(invitationParam);
            vi.mocked(invitationUtils.getInvitationData).mockReturnValue(null);

            InvitationService.handleInvitationParam(mockUrl, mockCookies);

            expect(mockCookies.set).not.toHaveBeenCalled();
        });
    });

    describe('processStoredInvitation', () => {
        const storedInvitation = 'stored-invitation-code';
        const inviterId = 'inviter-123';
        const userId = 'user-456';
        const inviter = { id: inviterId, username: 'Inviter' } as any;

        beforeEach(() => {
            mockCookies.get.mockReturnValue(storedInvitation);
            vi.mocked(invitationUtils.getInvitationData).mockReturnValue({ inviterId, timestamp: Date.now() });
            vi.mocked(playerService.findPlayerById).mockResolvedValue(inviter);
        });

        it('should return inviterInfo if invitation exists and inviter found', async () => {
            const result = await InvitationService.processStoredInvitation(mockCookies, { userId: null });

            expect(result.inviterInfo).toEqual(inviter);
            expect(result.redirectUrl).toBe('');
        });

        it('should process invitation if user is authenticated and not the inviter', async () => {
            vi.mocked(playerService.fetchOrCreatePlayer).mockResolvedValue({ id: userId, username: 'User' } as any);
            vi.mocked(playerService.favoritePlayer).mockResolvedValue(true);
            vi.mocked(playerService.findPlayerById).mockResolvedValueOnce(inviter).mockResolvedValueOnce({ id: userId, username: 'User' } as any); // First for inviter check, second for notification

            const result = await InvitationService.processStoredInvitation(mockCookies, { userId });

            expect(playerService.fetchOrCreatePlayer).toHaveBeenCalledWith(userId);
            expect(playerService.favoritePlayer).toHaveBeenCalledWith(userId, inviterId, true);
            expect(notificationService.createNotification).toHaveBeenCalled();
            expect(mockCookies.delete).toHaveBeenCalledWith('invitation', { path: '/' });
            expect(result.redirectUrl).toBe(`/p/${inviterId}`);
        });

        it('should not process invitation if user is the inviter', async () => {
             vi.mocked(invitationUtils.getInvitationData).mockReturnValue({ inviterId: userId, timestamp: Date.now() });
             vi.mocked(playerService.findPlayerById).mockResolvedValue({ id: userId, username: 'User' } as any);

             const result = await InvitationService.processStoredInvitation(mockCookies, { userId });

             expect(playerService.favoritePlayer).not.toHaveBeenCalled();
             expect(result.redirectUrl).toBe('');
             expect(result.inviterInfo).toBeDefined(); // still returns inviter info (self)
        });

        it('should handle missing cookie', async () => {
            mockCookies.get.mockReturnValue(undefined);
            const result = await InvitationService.processStoredInvitation(mockCookies, { userId });
            expect(result).toEqual({ inviterInfo: null, redirectUrl: '' });
        });

         it('should clear cookie if inviter not found', async () => {
            vi.mocked(playerService.findPlayerById).mockResolvedValue(null);

            const result = await InvitationService.processStoredInvitation(mockCookies, { userId });

            expect(mockCookies.delete).toHaveBeenCalledWith('invitation', { path: '/' });
            expect(result.inviterInfo).toBeNull();
        });

        it('should clear cookie if processing fails', async () => {
             vi.mocked(playerService.fetchOrCreatePlayer).mockRejectedValue(new Error('DB Error'));

             const result = await InvitationService.processStoredInvitation(mockCookies, { userId });

             expect(logger.error).toHaveBeenCalled();
             expect(mockCookies.delete).toHaveBeenCalledWith('invitation', { path: '/' });
             expect(result.inviterInfo).toBe(inviter); // It sets inviterInfo before failing
        });
    });
});
