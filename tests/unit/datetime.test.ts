import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	formatDateShort,
	formatDateFull,
	formatTimer,
	SECONDS,
	MINUTES,
	HOURS,
	DAYS,
	timeUntil,
	parseDuration,
	formatDuration
} from '../../src/lib/datetime';

// Add time mocking utility
export function mockCurrentTime(date: Date | string) {
	const mockDate = typeof date === 'string' ? new Date(date) : date;
	vi.useFakeTimers();
	vi.setSystemTime(mockDate);
	return mockDate;
}

describe('datetime utilities', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	describe('formatDateShort', () => {
		beforeEach(() => {
			mockCurrentTime('2024-01-15T12:00:00Z');
		});

		it.each([
			['2022-01-01T00:00:00', '2y'],
			['2023-07-01T00:00:00', '6mo'],
			['2024-01-10T00:00:00', '1/10']
		])('formats %s as %s', (dateString, expected) => {
			const date = new Date(dateString);
			expect(formatDateShort(date)).toBe(expected);
		});

		it('handles timezones', () => {
			const date = new Date('2024-01-10T06:00:00Z');
			expect(formatDateShort(date, 'America/New_York')).toBe('1/10');
			expect(formatDateShort(date, 'America/Los_Angeles')).toBe('1/9');
		});

		it('should format recent dates correctly', () => {
			const now = new Date();
			const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
			const result = formatDateShort(yesterday);
			expect(result).toMatch(/^\d{1,2}\/\d{1,2}$/);
		});

		it('should format old dates with years', () => {
			const now = new Date();
			const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
			const result = formatDateShort(twoYearsAgo);
			expect(result).toMatch(/^\d+y$/);
		});
	});

	describe('formatDateFull', () => {
		it('formats complete date with time', () => {
			const date = new Date('2024-01-15T14:30:00Z');
			const result = formatDateFull(date, 'America/New_York');
			expect(result).toMatch('January 15, 2024 at 9:30 AM EST');
		});

		it('handles timezones', () => {
			const date = new Date('2024-01-15T14:30:00Z');
			const result = formatDateFull(date, 'America/New_York');
			expect(result).toContain('EST');
		});

		it('should format dates with full details', () => {
			const date = new Date('2023-01-15T10:30:00Z');
			const result = formatDateFull(date, 'UTC');
			expect(result).toContain('January');
			expect(result).toContain('15');
			expect(result).toContain('2023');
		});
	});

	describe('formatTimer', () => {
		it.each([
			[DAYS * 2 + HOURS * 3 + MINUTES * 4 + SECONDS * 5, '2d 3:04:05'],
			[HOURS * 1 + MINUTES * 10 + SECONDS * 30, '1:10:30'],
			[MINUTES * 59 + SECONDS * 59, '59:59'],
			[0, '00:00']
		])('formats %d ms as %s', (ms, expected) => {
			expect(formatTimer(ms)).toBe(expected);
		});

		it('should format milliseconds correctly', () => {
			expect(formatTimer(5000)).toBe('00:05');
			expect(formatTimer(65000)).toBe('01:05');
			expect(formatTimer(3665000)).toBe('1:01:05');
			expect(formatTimer(90065000)).toBe('1d 1:01:05');
		});
	});

	describe('time constants', () => {
		it('has correct values', () => {
			expect(SECONDS).toBe(1000);
			expect(MINUTES).toBe(60000);
			expect(HOURS).toBe(3600000);
			expect(DAYS).toBe(86400000);
		});
	});

	it('should mock current time correctly', () => {
		const testDate = new Date('2024-01-01T00:00:00Z');
		mockCurrentTime(testDate);
		expect(Date.now()).toBe(testDate.getTime());
	});

	describe('timeUntil', () => {
		it('should calculate time until future date', () => {
			const future = new Date(Date.now() + 5000);
			const result = timeUntil(future);
			expect(result).toBeGreaterThan(4000);
			expect(result).toBeLessThan(6000);
		});
	});

	describe('parseDuration', () => {
		it('should parse simple durations', () => {
			expect(parseDuration('1h')).toBe(HOURS);
			expect(parseDuration('30m')).toBe(30 * MINUTES);
			expect(parseDuration('45s')).toBe(45 * SECONDS);
			expect(parseDuration('2d')).toBe(2 * DAYS);
		});

		it('should parse complex durations', () => {
			expect(parseDuration('1h30m')).toBe(HOURS + 30 * MINUTES);
			expect(parseDuration('2d12h')).toBe(2 * DAYS + 12 * HOURS);
			expect(parseDuration('1d2h30m45s')).toBe(DAYS + 2 * HOURS + 30 * MINUTES + 45 * SECONDS);
		});

		it('should handle case insensitive input', () => {
			expect(parseDuration('1H')).toBe(HOURS);
			expect(parseDuration('30M')).toBe(30 * MINUTES);
			expect(parseDuration('2D12H')).toBe(2 * DAYS + 12 * HOURS);
		});

		it('should handle whitespace', () => {
			expect(parseDuration(' 1h ')).toBe(HOURS);
			expect(parseDuration('  2h30m  ')).toBe(2 * HOURS + 30 * MINUTES);
		});

		it('should throw on invalid formats', () => {
			expect(() => parseDuration('')).toThrow('Duration must be a non-empty string');
			expect(() => parseDuration('   ')).toThrow('Duration must be a non-empty string');
			expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
			expect(() => parseDuration('1x')).toThrow('Invalid duration format');
			expect(() => parseDuration('1h2x')).toThrow('Invalid duration format');
		});

		it('should throw on zero duration', () => {
			expect(() => parseDuration('0h')).toThrow('Duration must be greater than 0');
			expect(() => parseDuration('0m')).toThrow('Duration must be greater than 0');
		});
	});

	describe('formatDuration', () => {
		describe('basic formatting', () => {
			it('should format simple durations', () => {
				expect(formatDuration(HOURS)).toBe('1h');
				expect(formatDuration(30 * MINUTES)).toBe('30m');
				expect(formatDuration(45 * SECONDS)).toBe('45s');
				expect(formatDuration(2 * DAYS)).toBe('2d');
			});

			it('should format complex durations', () => {
				expect(formatDuration(HOURS + 30 * MINUTES)).toBe('1h30m');
				expect(formatDuration(2 * DAYS + 12 * HOURS)).toBe('2d12h');
				// This gets rounded because minutes (30) > 10, so seconds are omitted
				expect(formatDuration(DAYS + 2 * HOURS + 30 * MINUTES + 45 * SECONDS)).toBe('1d2h30m');
			});

			it('should handle zero and negative values', () => {
				expect(formatDuration(0)).toBe('0s');
				expect(formatDuration(-1000)).toBe('-1s');
			});

			it('should omit zero components', () => {
				expect(formatDuration(HOURS + 45 * SECONDS)).toBe('1h45s');
				expect(formatDuration(2 * DAYS + 30 * MINUTES)).toBe('2d30m');
			});
		});

		describe('rounding behavior (default round=true)', () => {
			it('should round days > 3 to show only days', () => {
				expect(formatDuration(4 * DAYS + 12 * HOURS + 30 * MINUTES + 45 * SECONDS)).toBe('4d');
				expect(formatDuration(5 * DAYS + 23 * HOURS + 59 * MINUTES + 59 * SECONDS)).toBe('5d');
				expect(formatDuration(10 * DAYS + 1 * HOURS)).toBe('10d');
			});

			it('should not round days < 3, but may round based on hour component', () => {
				// 2 days + 23 hours: hours component = 23, which is > 10, so rounds to days+hours
				expect(formatDuration(2 * DAYS + 23 * HOURS + 59 * MINUTES + 59 * SECONDS)).toBe('2d23h');
				// 1 day + 1 hour: hours component = 1, which is <= 10, so shows all components
				expect(formatDuration(1 * DAYS + 1 * HOURS)).toBe('1d1h');
				// 1 day + 2 hours + 30 minutes: hours component = 2, which is <= 10, but minutes > 10 so rounds to d+h+m
				expect(formatDuration(1 * DAYS + 2 * HOURS + 30 * MINUTES + 45 * SECONDS)).toBe('1d2h30m');
			});

			it('should round hours > 9 to show only hours', () => {
				expect(formatDuration(11 * HOURS + 30 * MINUTES + 45 * SECONDS)).toBe('11h');
				expect(formatDuration(23 * HOURS + 59 * MINUTES + 59 * SECONDS)).toBe('23h');
				expect(formatDuration(15 * HOURS + 1 * MINUTES)).toBe('15h');
			});

			it('should not round hours <= 9, but may round based on minute component', () => {
				// 5 hours + 59 minutes: minutes component = 59, which is > 10, so rounds to hours+minutes
				expect(formatDuration(5 * HOURS + 59 * MINUTES + 59 * SECONDS)).toBe('5h59m');
				// 1 hour + 1 minute: minutes component = 1, which is <= 10, so shows all components
				expect(formatDuration(1 * HOURS + 1 * MINUTES)).toBe('1h1m');
			});

			it('should round minutes > 9 to show only minutes', () => {
				expect(formatDuration(11 * MINUTES + 45 * SECONDS)).toBe('11m');
				expect(formatDuration(59 * MINUTES + 59 * SECONDS)).toBe('59m');
				expect(formatDuration(15 * MINUTES + 1 * SECONDS)).toBe('15m');
			});

			it('should not round minutes <= 9', () => {
				expect(formatDuration(5 * MINUTES + 59 * SECONDS)).toBe('5m59s');
				expect(formatDuration(1 * MINUTES + 1 * SECONDS)).toBe('1m1s');
			});

			it('should show seconds when no larger units exceed rounding thresholds', () => {
				expect(formatDuration(59 * SECONDS)).toBe('59s');
				expect(formatDuration(1 * SECONDS)).toBe('1s');
			});
		});

		describe('non-rounding behavior (round=false)', () => {
			it('should show all components when round=false', () => {
				expect(formatDuration(4 * DAYS + 12 * HOURS + 30 * MINUTES + 45 * SECONDS, false)).toBe(
					'4d12h30m45s'
				);
				expect(formatDuration(11 * HOURS + 30 * MINUTES + 45 * SECONDS, false)).toBe('11h30m45s');
				expect(formatDuration(15 * MINUTES + 30 * SECONDS, false)).toBe('15m30s');
			});

			it('should still omit zero components when round=false', () => {
				expect(formatDuration(4 * DAYS + 30 * MINUTES, false)).toBe('4d30m');
				expect(formatDuration(2 * HOURS + 45 * SECONDS, false)).toBe('2h45s');
				expect(formatDuration(30 * MINUTES, false)).toBe('30m');
			});

			it('should handle edge cases with round=false', () => {
				expect(formatDuration(0, false)).toBe('0s');
				expect(formatDuration(-1000, false)).toBe('-1s');
				expect(formatDuration(1 * SECONDS, false)).toBe('1s');
			});
		});

		describe('edge cases and precision', () => {
			it('should handle fractional milliseconds by flooring', () => {
				expect(formatDuration(1500)).toBe('1s'); // 1.5 seconds -> 1s
				expect(formatDuration(59999)).toBe('59s'); // 59.999 seconds -> 59s
				expect(formatDuration(60001)).toBe('1m'); // 60.001 seconds -> 1m
			});

			it('should handle very large durations', () => {
				const veryLarge = 365 * DAYS + 12 * HOURS + 30 * MINUTES + 45 * SECONDS;
				expect(formatDuration(veryLarge)).toBe('365d');
			});

			it('should handle very small positive durations', () => {
				expect(formatDuration(1)).toBe('0s'); // Less than 1 second
				expect(formatDuration(999)).toBe('0s'); // Less than 1 second
				expect(formatDuration(1000)).toBe('1s'); // Exactly 1 second
			});
		});
	});

	describe('parseDuration and formatDuration round trip', () => {
		it('should maintain consistency in round trips for non-rounded durations', () => {
			// Test cases that should survive round trips with rounding enabled
			const testCases = ['1h', '30m', '2h30m', '1d', '7d'];

			for (const testCase of testCases) {
				const parsed = parseDuration(testCase);
				const formatted = formatDuration(parsed);
				const reparsed = parseDuration(formatted);
				expect(reparsed).toBe(parsed);
			}
		});

		it('should maintain consistency in round trips when rounding is disabled', () => {
			// Test cases that include components that would be rounded away
			const testCases = ['1h', '30m', '2h30m', '1d', '1d2h30m45s', '7d', '15h30m45s', '25m30s'];

			for (const testCase of testCases) {
				const parsed = parseDuration(testCase);
				const formatted = formatDuration(parsed, false); // No rounding
				const reparsed = parseDuration(formatted);
				expect(reparsed).toBe(parsed);
			}
		});

		it('should handle rounding effects on round trips', () => {
			// Test cases where rounding affects the result
			const testCase = '1d2h30m45s';
			const parsed = parseDuration(testCase); // 95445000 ms
			const formatted = formatDuration(parsed); // '1d2h30m' (seconds rounded away)
			const reparsed = parseDuration(formatted); // 95400000 ms (45 seconds lost)

			expect(reparsed).toBe(parsed - 45 * SECONDS); // Verify the expected loss
			expect(formatted).toBe('1d2h30m');
		});
	});
});
