import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import { generateUniqueUsername } from '$lib/server/services/playerService';

// Mock the prisma client
vi.mock('$lib/server/prisma', () => ({
	prisma: {
		player: {
			deleteMany: vi.fn(),
			create: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn()
		}
	}
}));

// Mock human-id
vi.mock('human-id', () => {
    return {
        humanId: vi.fn().mockReturnValue('Mock Username')
    };
});


describe('playerService', () => {
	beforeEach(async () => {
		// Reset mocks
		vi.resetAllMocks();
        const { humanId } = await import('human-id');
        vi.mocked(humanId).mockReturnValue('Mock Username');
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('generateUniqueUsername', () => {
		it('should return a username when it does not exist in DB', async () => {
			// Mock findUnique to return null (username doesn't exist)
			vi.mocked(prisma.player.findUnique).mockResolvedValue(null);

			const username = await generateUniqueUsername();

			expect(username).toBe('Mock Username');
			expect(prisma.player.findUnique).toHaveBeenCalledWith({
				where: { username: 'Mock Username' }
			});
		});

		it('should retry if username exists', async () => {
            // Import humanId to mock its return values
			const { humanId } = await import('human-id');

			// First call returns "Taken Name", second returns "Unique Name"
			vi.mocked(humanId)
				.mockReturnValueOnce('Taken Name')
				.mockReturnValueOnce('Unique Name');

			// First DB check finds a user, second checks doesn't
			vi.mocked(prisma.player.findUnique)
				.mockResolvedValueOnce({ id: '1' } as any)
				.mockResolvedValueOnce(null);

			const username = await generateUniqueUsername();

			expect(username).toBe('Unique Name');
			expect(prisma.player.findUnique).toHaveBeenCalledTimes(2);
		});

		it('should fallback to appending timestamp after max attempts', async () => {
            const { humanId } = await import('human-id');
			vi.mocked(humanId).mockReturnValue('Taken Name');

			// Always find a user
			vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: '1' } as any);

			const username = await generateUniqueUsername();

			// Should contain the base username and some numbers
			expect(username).toMatch(/Taken Name \d+/);
			// Should have tried 10 times (maxAttempts)
			expect(prisma.player.findUnique).toHaveBeenCalledTimes(10);
		});
	});
});
