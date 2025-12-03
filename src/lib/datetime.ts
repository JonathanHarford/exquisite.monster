export function formatDateShort(datetime: Date, timeZone?: string): string {
	const now = new Date();
	const msSince = now.getTime() - datetime.getTime();
	const yearsSince = Math.floor(msSince / (365 * DAYS));

	if (yearsSince >= 2) {
		return `${yearsSince}y`;
	}

	const monthsSince = Math.floor(msSince / (30 * DAYS));
	if (monthsSince >= 6) {
		return `${monthsSince}mo`;
	}
	// otherwise, do short date
	return datetime.toLocaleString('en-US', {
		month: 'numeric',
		day: 'numeric',
		timeZone
	});
}

export function formatDateFull(datetime: Date, timeZone?: string): string {
	return datetime.toLocaleString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short',
		timeZone
	});
}

export function formatTimer(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const dayString = days > 0 ? days + 'd ' : '';
	const hourString = hours > 0 ? Math.floor(hours % 24) + ':' : '';
	const minuteString = Math.floor(minutes % 60)
		.toString()
		.padStart(2, '0');
	const secondString = Math.floor(seconds % 60)
		.toString()
		.padStart(2, '0');
	return `${dayString}${hourString}${minuteString}:${secondString}`;
}

export const timeUntil = (datetime: Date): number => {
	return datetime.getTime() - new Date().getTime();
};

export const SECONDS = 1000;
export const MINUTES = SECONDS * 60;
export const HOURS = MINUTES * 60;
export const DAYS = HOURS * 24;

/**
 * Parse a duration string like "1h", "30m", "2h30m" into milliseconds
 */
export function parseDuration(durationStr: string): number {
	if (!durationStr || typeof durationStr !== 'string') {
		throw new Error('Duration must be a non-empty string');
	}

	const trimmed = durationStr.trim().toLowerCase();
	if (!trimmed) {
		throw new Error('Duration must be a non-empty string');
	}

	// Match patterns like "1h", "30m", "2h30m", "1d", "1d2h30m"
	const regex = /(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
	const match = trimmed.match(regex);

	if (!match || match[0] !== trimmed) {
		throw new Error('Invalid duration format. Use format like "1h", "30m", "2h30m", "1d2h30m"');
	}

	const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;

	const totalMs =
		parseInt(days) * DAYS +
		parseInt(hours) * HOURS +
		parseInt(minutes) * MINUTES +
		parseInt(seconds) * SECONDS;

	if (totalMs === 0) {
		throw new Error('Duration must be greater than 0');
	}

	return totalMs;
}

/**
 * Format milliseconds into a duration string like "1h", "30m", "2h30m"
 */
export function formatDuration(ms: number, round = true): string {
	if (ms < 0) {
		return '-' + formatDuration(-ms, round);
	}

	const days = Math.floor(ms / DAYS);
	const hours = Math.floor((ms % DAYS) / HOURS);
	const minutes = Math.floor((ms % HOURS) / MINUTES);
	const seconds = Math.floor((ms % MINUTES) / SECONDS);

	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (round && days > 2) return parts.join('');
	if (hours > 0) parts.push(`${hours}h`);
	if (round && hours > 9) return parts.join('');
	if (minutes > 0) parts.push(`${minutes}m`);
	if (round && minutes > 9) return parts.join('');
	if (seconds > 0) parts.push(`${seconds}s`);

	return parts.join('') || '0s';
}
