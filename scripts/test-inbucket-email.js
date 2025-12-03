#!/usr/bin/env node

/**
 * Test script to verify inbucket email functionality
 * Run this with: node scripts/test-inbucket-email.js
 * Make sure Supabase dev is running first: supabase start
 */

import { EmailService } from '../src/lib/server/services/emailService.js';

// Set up environment for inbucket testing
process.env.EMAIL_PROVIDER = 'inbucket';
process.env.ADMIN_EMAIL = 'admin@localhost';
process.env.FROM_EMAIL = 'noreply@localhost';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '54325';

async function testInbucketEmail() {
	console.log('🧪 Testing Inbucket email functionality...');

	try {
		// Initialize the email service
		EmailService.initialize();

		console.log(`📧 Email provider: ${EmailService.getProvider()}`);
		console.log(`✅ Email service enabled: ${EmailService.isEnabled()}`);

		if (!EmailService.isEnabled()) {
			console.error('❌ Email service is not enabled');
			process.exit(1);
		}

		// Test sending a flag notification
		const mockFlagData = {
			flagId: 'test-flag-123',
			turnId: 'test-turn-456',
			gameId: 'test-game-789',
			reason: 'spam',
			explanation: 'This is a test email sent via Inbucket',
			flaggerUsername: 'test_flagger',
			turnCreatorUsername: 'test_creator'
		};

		console.log('📤 Sending test flag notification...');
		await EmailService.sendFlagSubmittedNotification(mockFlagData);

		console.log('✅ Email sent successfully!');
		console.log('🌐 Check your Inbucket web interface at: http://127.0.0.1:54324');
		console.log('📬 Look for emails sent to: admin@localhost');
	} catch (error) {
		console.error('❌ Error testing email:', error);
		process.exit(1);
	}
}

testInbucketEmail();
