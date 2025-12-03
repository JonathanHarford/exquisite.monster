const INVITATION_COOKIE_KEY = 'invitation';

export interface InvitationData {
	inviterId: string;
	timestamp: number;
}

/**
 * Simple obfuscation for user IDs to make URLs less obvious
 * Reverses the string and base64 encodes it
 */
export function obfuscateUserId(userId: string): string {
	try {
		const reversed = userId.split('').reverse().join('');
		// Use Buffer for Node.js compatibility
		const base64 =
			typeof btoa !== 'undefined'
				? btoa(reversed)
				: Buffer.from(reversed, 'utf-8').toString('base64');
		const result = base64.replace(/[+/]/g, (char) => (char === '+' ? '-' : '_')).replace(/=/g, '');
		if (!result) {
			throw new Error('Obfuscation resulted in empty string');
		}
		return result;
	} catch (error) {
		// Fallback to original if obfuscation fails
		console.error('Obfuscation failed:', error);
		return userId;
	}
}

/**
 * Deobfuscates the user ID
 */
export function deobfuscateUserId(obfuscatedId: string): string | null {
	try {
		// Handle empty string
		if (!obfuscatedId) {
			return null;
		}

		// Add padding if needed and restore base64 characters
		const base64 = obfuscatedId.replace(/[-_]/g, (char) => (char === '-' ? '+' : '/'));
		const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

		// Use Buffer for Node.js compatibility
		const reversed =
			typeof atob !== 'undefined' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf-8');

		const result = reversed.split('').reverse().join('');

		return result;
	} catch (error) {
		console.error('Deobfuscation error:', error);
		return null;
	}
}

/**
 * Generates an invitation URL with obfuscated user ID
 */
export function generateInvitationUrl(baseUrl: string, userId: string): string {
	const obfuscatedId = obfuscateUserId(userId);
	if (!obfuscatedId) {
		throw new Error('Failed to obfuscate user ID');
	}
	const url = new URL(baseUrl);
	url.searchParams.set('i', obfuscatedId);
	return url.toString();
}

/**
 * Extracts invitation parameter from URL
 * Returns the obfuscated invitation ID if found
 */
export function extractInvitationParam(url: URL): string | null {
	return url.searchParams.get('i');
}

/**
 * Gets invitation data from the obfuscated invitation parameter
 */
export function getInvitationData(obfuscatedParam: string): InvitationData | null {
	const inviterId = deobfuscateUserId(obfuscatedParam);

	if (!inviterId) {
		console.error('Failed to deobfuscate invitation parameter:', obfuscatedParam);
		return null;
	}

	return {
		inviterId,
		timestamp: Date.now()
	};
}
