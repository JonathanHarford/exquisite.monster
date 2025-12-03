import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('EmailService', () => {
    let EmailService: typeof import('$lib/server/services/emailService').EmailService;
    let getMessageTemplate: ReturnType<typeof vi.fn>;
    
    const mockSendMail = vi.fn().mockResolvedValue(true);

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        
        // Set up environment variables for inbucket (SMTP) provider
        delete process.env.BREVO_API_KEY; // Ensure we use inbucket, not brevo
        process.env.SMTP_HOST = 'localhost';
        process.env.SMTP_PORT = '54325';
        process.env.ADMIN_EMAIL = 'admin@test.com';
        process.env.FROM_EMAIL = 'noreply@test.com';
        
        // Mock all dependencies using doMock for complete isolation
        vi.doMock('$lib/server/messaging', () => ({
            getMessageTemplate: vi.fn()
        }));
        vi.doMock('$lib/server/logger', () => ({
            logger: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn()
            }
        }));
        vi.doMock('$app/environment', () => ({
            dev: false
        }));
        vi.doMock('nodemailer', () => ({
            default: {
                createTransport: vi.fn().mockReturnValue({
                    sendMail: mockSendMail
                })
            }
        }));
        vi.doMock('@getbrevo/brevo', () => ({
            TransactionalEmailsApi: vi.fn().mockImplementation(() => ({
                setApiKey: vi.fn(),
                sendTransacEmail: vi.fn(),
            })),
            TransactionalEmailsApiApiKeys: {
                apiKey: 'mockApiKey'
            },
            SendSmtpEmail: vi.fn(),
        }));
        
        // Import modules after mocking
        const emailServiceModule = await import('$lib/server/services/emailService');
        EmailService = emailServiceModule.EmailService;
        const messagingModule = await import('$lib/server/messaging');
        getMessageTemplate = messagingModule.getMessageTemplate as ReturnType<typeof vi.fn>;
        
        // Reset EmailService state after import
        EmailService.reset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize successfully when properly configured', () => {
        EmailService.initialize();
        expect(EmailService.isEnabled()).toBe(true);
    });


    describe('sendFlagSubmittedNotification', () => {
        it('should send an email when a flag is submitted', async () => {
            EmailService.initialize();
            const data = {
                flagId: 'flag1',
                turnId: 'turn1',
                gameId: 'game1',
                reason: 'spam' as const,
                flaggerUsername: 'flagger',
                turnCreatorUsername: 'creator',
            };
            getMessageTemplate.mockResolvedValue({
                subject: 'Flag Submitted',
                title: 'Flag Submitted',
                body: 'A flag has been submitted',
                htmlBody: '<p>A flag has been submitted</p>',
            });

            await EmailService.sendFlagSubmittedNotification(data);

            expect(mockSendMail).toHaveBeenCalled();
            const sentMail = mockSendMail.mock.calls[0][0];
            expect(sentMail.to).toBe('admin@test.com');
            expect(sentMail.subject).toBe('Flag Submitted');
        });
    });

    describe('sendFlagConfirmedNotification', () => {
        it('should send an email when a flag is confirmed', async () => {
            EmailService.initialize();
            const data = {
                flagId: 'flag1',
                turnId: 'turn1',
                gameId: 'game1',
                reason: 'spam' as const,
                flaggerUsername: 'flagger',
                turnCreatorUsername: 'creator',
                adminUsername: 'admin',
            };
            getMessageTemplate.mockResolvedValue({
                subject: 'Flag Confirmed',
                title: 'Flag Confirmed',
                body: 'Your turn has been removed',
                htmlBody: '<p>Your turn has been removed</p>',
            });

            await EmailService.sendFlagConfirmedNotification(data, 'creator@test.com', 'creator');

            expect(mockSendMail).toHaveBeenCalled();
            const sentMail = mockSendMail.mock.calls[0][0];
            expect(sentMail.to).toBe('"creator" <creator@test.com>');
            expect(sentMail.subject).toBe('Flag Confirmed');
        });
    });

    describe('sendFlagRejectedNotification', () => {
        it('should send an email when a flag is rejected', async () => {
            EmailService.initialize();
            const data = {
                flagId: 'flag1',
                turnId: 'turn1',
                gameId: 'game1',
                reason: 'spam' as const,
                flaggerUsername: 'flagger',
                turnCreatorUsername: 'creator',
                adminUsername: 'admin',
            };
            getMessageTemplate.mockResolvedValue({
                subject: 'Flag Rejected',
                title: 'Flag Rejected',
                body: 'Your flag has been rejected',
                htmlBody: '<p>Your flag has been rejected</p>',
            });

            await EmailService.sendFlagRejectedNotification(data, 'flagger@test.com', 'flagger');

            expect(mockSendMail).toHaveBeenCalled();
            const sentMail = mockSendMail.mock.calls[0][0];
            expect(sentMail.to).toBe('"flagger" <flagger@test.com>');
            expect(sentMail.subject).toBe('Flag Rejected');
        });
    });

    describe('sendNotificationEmail', () => {
        it('should send a generic notification email', async () => {
            EmailService.initialize();
            const emailData = {
                to: 'user@test.com',
                subject: 'Test Notification',
                text: 'This is a test',
                html: '<p>This is a test</p>',
                toName: 'Test User',
            };

            await EmailService.sendNotificationEmail(emailData);

            expect(mockSendMail).toHaveBeenCalled();
            const sentMail = mockSendMail.mock.calls[0][0];
            expect(sentMail.to).toBe('"Test User" <user@test.com>');
            expect(sentMail.subject).toBe('Test Notification');
        });
    });
});
