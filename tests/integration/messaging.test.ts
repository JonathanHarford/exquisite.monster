import { describe as vitestDescribe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import {
        fetchMessageTemplates,
        interpolateTemplate,
        processMessageTemplate,
        getMessageTemplate,
        getMessageTemplates,
        type MessageTemplate
} from '$lib/server/messaging';

const describe = process.env.DATABASE_URL ? vitestDescribe : vitestDescribe.skip;

describe('Messaging System utility functions', () => {
        describe('interpolateTemplate', () => {
                it('should interpolate basic variables', () => {
                        const template = 'Hello ${name}, your score is ${score}!';
                        const data = { name: 'John', score: 95 };

                        const result = interpolateTemplate(template, data);

                        expect(result).toBe('Hello John, your score is 95!');
                });

                it('should include common variables', () => {
                        const template = 'Welcome to ${SITE_TITLE} at ${BASE_URL}';
                        const data = {};

                        const result = interpolateTemplate(template, data);

                        expect(result).toContain('Welcome to');
                        expect(result).toContain('http'); // Should contain the base URL
                });

                it('should handle missing variables gracefully', () => {
                        const template = 'Hello ${name}, your ${missing} is ready!';
                        const data = { name: 'John' };

                        const result = interpolateTemplate(template, data);

                        expect(result).toBe('Hello John, your ${missing} is ready!');
                });

                it('should handle null and undefined values', () => {
                        const template = 'Value: ${nullValue} and ${undefinedValue}';
                        const data = { nullValue: null, undefinedValue: undefined };

                        const result = interpolateTemplate(template, data);

                        expect(result).toBe('Value: ${nullValue} and ${undefinedValue}');
                });

                it('should convert non-string values to strings', () => {
                        const template = 'Score: ${score}, Date: ${date}, Active: ${active}';
                        const testDate = new Date('2024-01-01T12:00:00Z'); // Use UTC midday to avoid timezone issues
                        const data = {
                                score: 95,
                                date: testDate,
                                active: true
                        };

                        const result = interpolateTemplate(template, data);

                        expect(result).toContain('Score: 95');
                        expect(result).toContain('Active: true');
                        expect(result).toContain('Date: ');
                        // Just check that the date is converted to a string, don't check specific format
                        expect(result).toMatch(/Date: \w/); // Should have some text after "Date: "
                });
        });

        describe('processMessageTemplate', () => {
                it('should process all template fields', () => {
                        const template: MessageTemplate = {
                                subject: 'Subject: ${name}',
                                title: 'Title: ${name}',
                                body: 'Body: ${name}',
                                htmlBody: '<p>HTML: ${name}</p>'
                        };
                        const data = { name: 'John' };

                        const result = processMessageTemplate(template, data);

                        expect(result).toEqual({
                                subject: 'Subject: John',
                                title: 'Title: John',
                                body: 'Body: John',
                                htmlBody: '<p>HTML: John</p>'
                        });
                });

                it('should handle optional fields', () => {
                        const template: MessageTemplate = {
                                title: 'Title: ${name}',
                                body: 'Body: ${name}'
                        };
                        const data = { name: 'John' };

                        const result = processMessageTemplate(template, data);

                        expect(result).toEqual({
                                subject: undefined,
                                title: 'Title: John',
                                body: 'Body: John',
                                htmlBody: undefined
                        });
                });
        });
});

describe('Messaging System database operations', () => {
        // Clean up test data
        afterEach(async () => {
                await prisma.copyText.deleteMany({
                        where: {
                                key: {
                                        startsWith: 'test.'
                                }
                        }
                });
        });

        describe('fetchMessageTemplates', () => {
                beforeEach(async () => {
                        // Create test templates
                        await prisma.copyText.createMany({
                                data: [
                                        { key: 'test.complete.subject', lang: 'en', value: 'Test Complete: ${title}' },
                                        { key: 'test.complete.title', lang: 'en', value: 'Test Complete' },
                                        {
                                                key: 'test.complete.body',
                                                lang: 'en',
                                                value: 'Your test ${testName} has completed successfully.'
                                        },
                                        {
                                                key: 'test.complete.html_body',
                                                lang: 'en',
                                                value:
                                                        '<h2>Test Complete</h2><p>Your test <strong>${testName}</strong> has completed successfully.</p>'
                                        },
                                        { key: 'test.partial.title', lang: 'en', value: 'Partial Template' },
                                        { key: 'test.partial.body', lang: 'en', value: 'This template has no subject or HTML.' }
                                ]
                        });
                });

                it('should fetch complete message templates', async () => {
                        const templates = await fetchMessageTemplates(['test.complete']);

                        expect(templates['test.complete']).toEqual({
                                subject: 'Test Complete: ${title}',
                                title: 'Test Complete',
                                body: 'Your test ${testName} has completed successfully.',
                                htmlBody:
                                        '<h2>Test Complete</h2><p>Your test <strong>${testName}</strong> has completed successfully.</p>'
                        });
                });

                it('should handle partial templates', async () => {
                        const templates = await fetchMessageTemplates(['test.partial']);

                        expect(templates['test.partial']).toEqual({
                                subject: undefined,
                                title: 'Partial Template',
                                body: 'This template has no subject or HTML.',
                                htmlBody: undefined
                        });
                });

                it('should handle missing templates', async () => {
                        const templates = await fetchMessageTemplates(['test.nonexistent']);

                        expect(templates['test.nonexistent']).toBeUndefined();
                });

                it('should fetch multiple templates', async () => {
                        const templates = await fetchMessageTemplates(['test.complete', 'test.partial']);

                        expect(Object.keys(templates)).toHaveLength(2);
                        expect(templates['test.complete']).toBeDefined();
                        expect(templates['test.partial']).toBeDefined();
                });
        });

        describe('getMessageTemplate', () => {
                beforeEach(async () => {
                        await prisma.copyText.createMany({
                                data: [
                                        { key: 'test.welcome.subject', lang: 'en', value: 'Welcome ${name}!' },
                                        { key: 'test.welcome.title', lang: 'en', value: 'Welcome' },
                                        {
                                                key: 'test.welcome.body',
                                                lang: 'en',
                                                value: 'Hello ${name}, welcome to ${SITE_TITLE}!'
                                        }
                                ]
                        });
                });

                it('should get and process a single template', async () => {
                        const result = await getMessageTemplate('test.welcome', { name: 'John' });

                        expect(result).toEqual({
                                subject: 'Welcome John!',
                                title: 'Welcome',
                                body: expect.stringContaining('Hello John, welcome to'),
                                htmlBody: undefined
                        });
                });

                it('should return null for missing template', async () => {
                        const result = await getMessageTemplate('test.missing', { name: 'John' });

                        expect(result).toBeNull();
                });
        });

        describe('getMessageTemplates', () => {
                beforeEach(async () => {
                        await prisma.copyText.createMany({
                                data: [
                                        { key: 'test.one.title', lang: 'en', value: 'Template One' },
                                        { key: 'test.one.body', lang: 'en', value: 'This is template one for ${name}.' },
                                        { key: 'test.two.title', lang: 'en', value: 'Template Two' },
                                        { key: 'test.two.body', lang: 'en', value: 'This is template two for ${name}.' }
                                ]
                        });
                });

                it('should get and process multiple templates', async () => {
                        const result = await getMessageTemplates(['test.one', 'test.two'], { name: 'John' });

                        expect(result['test.one']).toEqual({
                                subject: undefined,
                                title: 'Template One',
                                body: 'This is template one for John.',
                                htmlBody: undefined
                        });

                        expect(result['test.two']).toEqual({
                                subject: undefined,
                                title: 'Template Two',
                                body: 'This is template two for John.',
                                htmlBody: undefined
                        });
                });
        });

        describe('Real notification templates', () => {
                beforeEach(async () => {
                        // Ensure required notification templates exist for these tests
                        // This makes the tests more robust against test execution order issues
                        await prisma.copyText.createMany({
                                data: [
                                        // Game completion templates
                                        {
                                                key: 'notification.game_completion.subject',
                                                lang: 'en',
                                                value: '[{{SITE_TITLE}}] Game Complete!'
                                        },
                                        { key: 'notification.game_completion.title', lang: 'en', value: 'Game Complete!' },
                                        {
                                                key: 'notification.game_completion.body',
                                                lang: 'en',
                                                value:
                                                        'A game you participated in has been completed. View the full game to see how your contributions evolved through the chain of turns!'
                                        },
                                        {
                                                key: 'notification.game_completion.html_body',
                                                lang: 'en',
                                                value:
                                                        '<h2>Game Complete!</h2><p>A game you participated in has been completed.</p><p>View the full game to see how your contributions evolved through the chain of turns!</p><p><a href="{{BASE_URL}}/g/{{gameId}}">View Game</a></p>'
                                        },

                                        // Admin flag templates
                                        {
                                                key: 'notification.admin_flag.subject',
                                                lang: 'en',
                                                value: '[{{SITE_TITLE}}] Turn Flagged for Review'
                                        },
                                        { key: 'notification.admin_flag.title', lang: 'en', value: 'Turn Flagged for Review' },
                                        {
                                                key: 'notification.admin_flag.body',
                                                lang: 'en',
                                                value:
                                                        '{{flaggerUsername}} flagged a turn by {{turnCreatorUsername}} for {{reason}}{{explanationSuffix}}'
                                        },
                                        {
                                                key: 'notification.admin_flag.html_body',
                                                lang: 'en',
                                                value:
                                                        '<h2>Turn Flagged for Review</h2><p><strong>{{flaggerUsername}}</strong> flagged a turn by <strong>{{turnCreatorUsername}}</strong> for <strong>{{reason}}</strong>.</p>{{explanationHtml}}<p><a href="{{BASE_URL}}/g/{{gameId}}">Review Flag</a></p>'
                                        },

                                        // Contact form templates
                                        {
                                                key: 'notification.contact_form.subject',
                                                lang: 'en',
                                                value: '[{{SITE_TITLE}}] Contact Form: {{subject}}'
                                        },
                                        {
                                                key: 'notification.contact_form.title',
                                                lang: 'en',
                                                value: 'Contact Form: {{subject}}'
                                        },
                                        {
                                                key: 'notification.contact_form.body',
                                                lang: 'en',
                                                value:
                                                        'New contact form submission from {{senderName}} ({{senderEmail}}):\n\n{{message}}'
                                        },
                                        {
                                                key: 'notification.contact_form.html_body',
                                                lang: 'en',
                                                value:
                                                        '<h2>Contact Form Submission</h2><p><strong>From:</strong> {{senderName}} ({{senderEmail}})</p><p><strong>Subject:</strong> {{subject}}</p><p><strong>Message:</strong></p><blockquote>{{message}}</blockquote><p><a href="{{BASE_URL}}/admin">Go to Admin Dashboard</a></p>'
                                        }
                                ],
                                skipDuplicates: true // Avoid errors if templates already exist
                        });
                });

                it('should load game completion template', async () => {
                        const template = await getMessageTemplate('notification.game_completion', {
                                gameId: 'g_test123'
                        });

                        expect(template).toBeDefined();
                        expect(template?.title).toBe('Game Complete!');
                        expect(template?.body).toContain('A game you participated in has been completed');
                        expect(template?.subject).toContain('Game Complete!');
                });

                it('should load admin flag template', async () => {
                        const template = await getMessageTemplate('notification.admin_flag', {
                                flaggerUsername: 'alice',
                                turnCreatorUsername: 'bob',
                                reason: 'spam',
                                explanation: 'This looks like spam content',
                                gameId: 'g_test123',
                                explanationSuffix: ': This looks like spam content',
                                explanationHtml: '<p><strong>Explanation:</strong> This looks like spam content</p>'
                        });

                        expect(template).toBeDefined();
                        expect(template?.title).toBe('Turn Flagged for Review');
                        expect(template?.body).toContain('alice flagged a turn by bob for spam');
                        expect(template?.body).toContain('This looks like spam content');
                });

                it('should load contact form template', async () => {
                        const template = await getMessageTemplate('notification.contact_form', {
                                senderName: 'John Doe',
                                senderEmail: 'john@example.com',
                                subject: 'Bug Report',
                                message: 'I found a bug in the game.'
                        });

                        expect(template).toBeDefined();
                        expect(template?.title).toBe('Contact Form: Bug Report');
                        expect(template?.body).toContain('New contact form submission from John Doe');
                        expect(template?.body).toContain('I found a bug in the game.');
                });
        });
});
