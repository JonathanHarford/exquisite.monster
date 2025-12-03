import * as brevo from '@getbrevo/brevo';
import nodemailer from 'nodemailer';
import { logger } from '$lib/server/logger';
import { getMessageTemplate } from '$lib/server/messaging.js';
import { dev } from '$app/environment';
import * as Sentry from '@sentry/sveltekit';

type EmailProvider = 'brevo' | 'inbucket';

export interface FlagSubmittedData {
	flagId: string;
	turnId: string;
	gameId: string;
	reason: 'spam' | 'offensive' | 'other';
	explanation?: string;
	flaggerUsername: string;
	turnCreatorUsername: string;
}

export interface FlagResolvedData {
	flagId: string;
	turnId: string;
	gameId: string;
	reason: 'spam' | 'offensive' | 'other';
	explanation?: string;
	flaggerUsername: string;
	turnCreatorUsername: string;
	adminUsername: string;
}

export class EmailService {
	private static initialized = false;
	private static provider: EmailProvider;
	private static brevoTransactionalApi: brevo.TransactionalEmailsApi | null = null;
	private static smtpTransporter: nodemailer.Transporter | null = null;
	private static brevoFailed = false; // Circuit breaker for Brevo failures

	private static getEmailProvider(): EmailProvider {
		const apiKey = process.env.BREVO_API_KEY?.trim();
		const emailProvider: string = apiKey && apiKey.length > 0 ? 'brevo' : 'inbucket';
		return emailProvider as EmailProvider;
	}

	private static getBrevoApiKey(): string | undefined {
		return process.env.BREVO_API_KEY?.trim();
	}

	private static getAdminEmail(): string | undefined {
		return process.env.ADMIN_EMAIL;
	}

	private static getFromEmail(): string | undefined {
		return process.env.FROM_EMAIL;
	}

	private static getSmtpConfig() {
		return {
			host: process.env.SMTP_HOST || '127.0.0.1',
			port: parseInt(process.env.SMTP_PORT || '54325'),
			secure: false, // true for 465, false for other ports
			auth: process.env.SMTP_USERNAME
				? {
						user: process.env.SMTP_USERNAME,
						pass: process.env.SMTP_PASSWORD || ''
					}
				: undefined,
			sender: process.env.FROM_EMAIL || 'admin@localhost'
		};
	}

	static initialize() {
		if (this.initialized) return;

		const configuredProvider = this.getEmailProvider();

		if (configuredProvider === 'brevo') {
			this.initializeBrevo(process.env.BREVO_API_KEY!);
		} else {
			this.initializeInbucket();
		}

		this.initialized = true;
	}

	private static initializeBrevo(apiKey: string) {
		try {
			// Validate API key format (Brevo keys typically start with 'xkeysib-')
			if (!apiKey || apiKey.length < 10) {
				logger.warn('Invalid or empty Brevo API key', {
					hasApiKey: !!apiKey,
					apiKeyLength: apiKey?.length || 0,
					environment: dev ? 'development' : 'production'
				});

				// In dev, fall back to Inbucket. In production, disable email.
				if (dev) {
					logger.info('Development mode: falling back to Inbucket');
					this.initializeInbucket();
				} else {
					logger.error('Production mode: Email service disabled due to invalid Brevo API key');
					// Don't initialize anything - email will be disabled
				}
				return;
			}

			this.brevoTransactionalApi = new brevo.TransactionalEmailsApi();
			this.brevoTransactionalApi.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
			this.provider = 'brevo';
			logger.info('Email service initialized with Brevo', {
				apiKeyPrefix: apiKey.substring(0, 10) + '...'
			});
		} catch (error) {
			logger.error('Failed to initialize Brevo', {
				error: error instanceof Error ? error.message : String(error),
				environment: dev ? 'development' : 'production'
			});

			// In dev, fall back to Inbucket. In production, disable email.
			if (dev) {
				logger.info('Development mode: falling back to Inbucket');
				this.initializeInbucket();
			} else {
				logger.error('Production mode: Email service disabled due to Brevo initialization failure');
				// Don't initialize anything - email will be disabled
			}
		}
	}

	private static initializeInbucket() {
		try {
			const smtpConfig = this.getSmtpConfig();
			this.smtpTransporter = nodemailer.createTransport(smtpConfig);
			this.provider = 'inbucket';
			logger.info(
				`Email service initialized with Inbucket/SMTP (${smtpConfig.host}:${smtpConfig.port})`
			);
		} catch (error) {
			logger.error('Failed to initialize Inbucket/SMTP', {
				error: error instanceof Error ? error.message : String(error)
			});
			// Don't fall back further - if we can't use SMTP, email is disabled
		}
	}

	// For testing: force re-initialization
	static reinitialize() {
		this.initialized = false;
		this.brevoTransactionalApi = null;
		this.smtpTransporter = null;
		this.initialize();
	}

	// For testing: reset service state
	static reset() {
		this.initialized = false;
		this.brevoTransactionalApi = null;
		this.smtpTransporter = null;
	}

	static isEnabled(): boolean {
		// Always check if we need to initialize first
		if (!this.initialized) {
			this.initialize();
		}

		if (this.provider === 'brevo') {
			return !!this.brevoTransactionalApi && !!this.getBrevoApiKey();
		} else {
			return !!this.smtpTransporter;
		}
	}

	static getProvider(): EmailProvider | null {
		if (!this.initialized) {
			this.initialize();
		}
		return this.provider || null;
	}

	private static async sendEmailViaBrevo(emailData: {
		to: { name?: string; email: string };
		from: { name?: string; email: string };
		subject: string;
		textContent: string;
		htmlContent: string;
	}): Promise<void> {
		if (!this.brevoTransactionalApi) {
			throw new Error('Brevo API not initialized');
		}

		const sendSmtpEmail = new brevo.SendSmtpEmail();
		sendSmtpEmail.subject = emailData.subject;
		sendSmtpEmail.htmlContent = emailData.htmlContent;
		sendSmtpEmail.textContent = emailData.textContent;
		sendSmtpEmail.sender = emailData.from;
		sendSmtpEmail.to = [emailData.to];

		try {
			await this.brevoTransactionalApi.sendTransacEmail(sendSmtpEmail);
		} catch (error: any) {
			if (error?.response?.status === 401 || error?.status === 401) {
				logger.error('Brevo authentication failed - invalid API key', {
					status: error?.response?.status || error?.status,
					message: error?.message
				});

				// Mark Brevo as failed to prevent future attempts
				this.brevoFailed = true;

				Sentry.captureException(error, {
					tags: {
						service: 'email',
						provider: 'brevo',
						errorType: 'auth_failure'
					},
					extra: {
						status: error?.response?.status || error?.status,
						apiKeyConfigured: !!process.env.BREVO_API_KEY
					}
				});
			}
			throw error;
		}
	}

	private static async sendEmailViaInbucket(emailData: {
		to: { name?: string; email: string };
		from: { name?: string; email: string };
		subject: string;
		textContent: string;
		htmlContent: string;
	}): Promise<void> {
		if (!this.smtpTransporter) {
			throw new Error('SMTP transporter not initialized');
		}

		const toAddress = emailData.to.name
			? `"${emailData.to.name}" <${emailData.to.email}>`
			: emailData.to.email;
		const fromAddress = emailData.from.name
			? `"${emailData.from.name}" <${emailData.from.email}>`
			: emailData.from.email;

		const mailOptions = {
			from: fromAddress,
			to: toAddress,
			subject: emailData.subject,
			text: emailData.textContent,
			html: emailData.htmlContent
		};

		await this.smtpTransporter.sendMail(mailOptions);
	}

	private static async sendEmail(emailData: {
		to: { name?: string; email: string };
		from: { name?: string; email: string };
		subject: string;
		textContent: string;
		htmlContent: string;
	}): Promise<void> {
		if (!this.isEnabled()) {
			throw new Error('Email service not enabled');
		}

		// If Brevo has failed before in production, throw error
		if (this.provider === 'brevo' && this.brevoFailed) {
			const error = new Error('Brevo API authentication failed - check BREVO_API_KEY environment variable');

			if (dev) {
				// In dev, fall back to Inbucket if available
				logger.warn('Brevo failed in dev, attempting Inbucket fallback');
				if (this.smtpTransporter) {
					await this.sendEmailViaInbucket(emailData);
					return;
				}
				this.initializeInbucket();
				if (this.smtpTransporter) {
					await this.sendEmailViaInbucket(emailData);
					return;
				}
			}

			// In production or if Inbucket unavailable, throw error
			throw error;
		}

		if (this.provider === 'brevo') {
			await this.sendEmailViaBrevo(emailData);
		} else {
			await this.sendEmailViaInbucket(emailData);
		}
	}

	static async sendFlagSubmittedNotification(data: FlagSubmittedData): Promise<void> {
		if (!this.isEnabled()) {
			logger.debug('Email service not enabled, skipping flag submitted notification');
			return;
		}

		const adminEmail = this.getAdminEmail();
		if (!adminEmail) {
			logger.warn('ADMIN_EMAIL not configured, cannot send flag notification');
			return;
		}

		const templateData = {
			gameId: data.gameId,
			turnId: data.turnId,
			flagId: data.flagId,
			reason: data.reason,
			flaggerUsername: data.flaggerUsername,
			turnCreatorUsername: data.turnCreatorUsername,
			explanationSuffix: data.explanation ? `. Explanation: ${data.explanation}` : '',
			explanationHtml: data.explanation
				? `<p><strong>Explanation:</strong> ${data.explanation}</p>`
				: ''
		};

		const template = await getMessageTemplate('notification.admin_flag', templateData);
		if (!template) {
			logger.error('Admin flag notification template not found');
			return;
		}

		try {
			await this.sendEmail({
				to: { email: adminEmail },
				from: { email: this.getFromEmail() || adminEmail },
				subject: template.subject!,
				textContent: template.body,
				htmlContent: template.htmlBody || template.body
			});

			logger.info(`Flag submitted notification sent via ${this.provider} for flag ${data.flagId}`);
		} catch (error) {
			Sentry.captureException(error, {
				tags: {
					service: 'email',
					emailType: 'flag_submitted',
					provider: this.provider
				},
				extra: {
					flagId: data.flagId,
					adminEmail
				}
			});

			logger.error('Failed to send flag submitted notification', {
				error: error instanceof Error ? error.message : String(error),
				flagId: data.flagId
			});

			// In development, be graceful for admin users without emails (for testing)
			// In production, we want to throw errors for missing emails
			if (dev) {
				logger.warn(
					'Flag submitted notification failed in development mode, continuing gracefully',
					{
						flagId: data.flagId,
						adminEmail
					}
				);
				return;
			}

			throw error;
		}
	}

	static async sendFlagConfirmedNotification(
		data: FlagResolvedData,
		turnCreatorEmail: string,
		turnCreatorUsername?: string
	): Promise<void> {
		if (!this.isEnabled()) {
			logger.debug('Email service not enabled, skipping flag confirmed notification');
			return;
		}

		const templateData = {
			turnId: data.turnId,
			gameId: data.gameId,
			reason: data.reason,
			adminUsername: data.adminUsername,
			explanationSuffix: data.explanation ? `. Explanation: ${data.explanation}` : '',
			explanationHtml: data.explanation
				? `<p><strong>Explanation:</strong> ${data.explanation}</p>`
				: ''
		};

		const template = await getMessageTemplate('notification.turn_rejected', templateData);
		if (!template) {
			logger.error('Turn rejected notification template not found');
			return;
		}

		try {
			await this.sendEmail({
				to: {
					name: turnCreatorUsername || data.turnCreatorUsername,
					email: turnCreatorEmail
				},
				from: { email: this.getFromEmail() || this.getAdminEmail()! },
				subject: template.subject!,
				textContent: template.body,
				htmlContent: template.htmlBody || template.body
			});

			logger.info(`Flag confirmed notification sent via ${this.provider} for flag ${data.flagId}`);
		} catch (error) {
			Sentry.captureException(error, {
				tags: {
					service: 'email',
					emailType: 'flag_confirmed',
					provider: this.provider
				},
				extra: {
					flagId: data.flagId,
					turnCreatorEmail
				}
			});

			logger.error('Failed to send flag confirmed notification', {
				error: error instanceof Error ? error.message : String(error),
				flagId: data.flagId
			});

			// In development, be graceful for users without emails (for testing)
			// In production, we want to throw errors for missing emails
			if (dev) {
				logger.warn(
					'Flag confirmed notification failed in development mode, continuing gracefully',
					{
						flagId: data.flagId,
						turnCreatorEmail
					}
				);
				return;
			}

			throw error;
		}
	}

	static async sendFlagRejectedNotification(
		data: FlagResolvedData,
		flaggerEmail: string,
		flaggerUsername?: string
	): Promise<void> {
		if (!this.isEnabled()) {
			logger.debug('Email service not enabled, skipping flag rejected notification');
			return;
		}

		const templateData = {
			turnCreatorUsername: data.turnCreatorUsername,
			reason: data.reason,
			adminUsername: data.adminUsername,
			explanationSuffix: data.explanation ? `. Explanation: ${data.explanation}` : '',
			explanationHtml: data.explanation
				? `<p><strong>Explanation:</strong> ${data.explanation}</p>`
				: ''
		};

		const template = await getMessageTemplate('notification.flag_rejected', templateData);
		if (!template) {
			logger.error('Flag rejected notification template not found');
			return;
		}

		try {
			await this.sendEmail({
				to: {
					name: flaggerUsername,
					email: flaggerEmail
				},
				from: { email: this.getFromEmail() || this.getAdminEmail()! },
				subject: template.subject!,
				textContent: template.body,
				htmlContent: template.htmlBody || template.body
			});

			logger.info(`Flag rejected notification sent via ${this.provider} for flag ${data.flagId}`);
		} catch (error) {
			Sentry.captureException(error, {
				tags: {
					service: 'email',
					emailType: 'flag_rejected',
					provider: this.provider
				},
				extra: {
					flagId: data.flagId,
					flaggerEmail
				}
			});

			logger.error('Failed to send flag rejected notification', {
				error: error instanceof Error ? error.message : String(error),
				flagId: data.flagId
			});

			// In development, be graceful for users without emails (for testing)
			// In production, we want to throw errors for missing emails
			if (dev) {
				logger.warn(
					'Flag rejected notification failed in development mode, continuing gracefully',
					{
						flagId: data.flagId,
						flaggerEmail
					}
				);
				return;
			}

			throw error;
		}
	}

	static async sendNotificationEmail(emailData: {
		to: string;
		subject: string;
		text: string;
		html?: string;
		toName?: string;
	}): Promise<void> {
		if (!this.isEnabled()) {
			logger.debug('Email service not enabled, skipping notification email');
			return;
		}

		try {
			await this.sendEmail({
				to: {
					name: emailData.toName,
					email: emailData.to
				},
				from: { email: this.getFromEmail() || this.getAdminEmail() || 'noreply@localhost' },
				subject: emailData.subject,
				textContent: emailData.text,
				htmlContent: emailData.html || emailData.text
			});

			logger.info(`Notification email sent via ${this.provider} to ${emailData.to}`);
		} catch (error) {
			Sentry.captureException(error, {
				tags: {
					service: 'email',
					emailType: 'notification',
					provider: this.provider
				},
				extra: {
					to: emailData.to,
					subject: emailData.subject
				}
			});

			logger.error('Failed to send notification email', {
				error: error instanceof Error ? error.message : String(error),
				to: emailData.to,
				subject: emailData.subject
			});

			// In development, be graceful for users without emails (for testing)
			// In production, we want to throw errors for missing emails
			if (dev) {
				logger.warn('Email sending failed in development mode, continuing gracefully', {
					to: emailData.to,
					subject: emailData.subject
				});
				return;
			}

			throw error;
		}
	}
}
