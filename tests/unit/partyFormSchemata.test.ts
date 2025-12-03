import { describe, it, expect } from 'vitest';
import { partyCreationSchema } from '../../src/lib/formSchemata';

describe('partyCreationSchema', () => {
	it('should validate a valid party creation form', () => {
		const validData = {
			title: 'Test Party',
			turnPassingAlgorithm: 'round-robin' as const,
			allowPlayerInvites: false
		};

		const result = partyCreationSchema.safeParse(validData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.title).toBe('Test Party');
			expect(result.data.turnPassingAlgorithm).toBe('round-robin');
			expect(result.data.allowPlayerInvites).toBe(false);
		}
	});

	it('should reject invalid title', () => {
		const invalidData = {
			title: 'ab', // Too short
			turnPassingAlgorithm: 'round-robin' as const,
			allowPlayerInvites: false
		};

		const result = partyCreationSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.error.issues.some(
					(issue) => issue.path.includes('title') && issue.message.includes('at least 3 characters')
				)
			).toBe(true);
		}
	});

	it('should validate turn passing algorithms', () => {
		const roundRobinData = {
			title: 'Round Robin Party',
			turnPassingAlgorithm: 'round-robin' as const,
			allowPlayerInvites: false
		};

		const algorithmicData = {
			title: 'Algorithmic Party',
			turnPassingAlgorithm: 'algorithmic' as const,
			allowPlayerInvites: false
		};

		expect(partyCreationSchema.safeParse(roundRobinData).success).toBe(true);
		expect(partyCreationSchema.safeParse(algorithmicData).success).toBe(true);
	});

	it('should validate boolean fields with defaults', () => {
		const minimalData = {
			title: 'Minimal Party',
			turnPassingAlgorithm: 'round-robin' as const
			// allowPlayerInvites should get default
		};

		const result = partyCreationSchema.safeParse(minimalData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.allowPlayerInvites).toBe(false);
		}
	});
});
