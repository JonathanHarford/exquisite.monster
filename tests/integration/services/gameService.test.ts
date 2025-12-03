import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '$lib/server/prisma';
import { createComment, getCommentsByGameId } from '$lib/server/services/gameService';
import type { Game, Player } from '@prisma/client';

describe('gameService', () => {
	let testGame: Game;
	let testPlayer1: Player;
	let testPlayer2: Player;

	beforeEach(async () => {
		// Clean up existing test data
		await prisma.comment.deleteMany({
			where: {
				OR: [
					{ gameId: { startsWith: 'test-game-' } },
					{ playerId: { startsWith: 'test-comment-player-' } }
				]
			}
		});
		await prisma.game.deleteMany({
			where: { id: { startsWith: 'test-game-' } }
		});
		await prisma.gameConfig.deleteMany({
			where: { id: { startsWith: 'test-config-' } }
		});
		await prisma.player.deleteMany({
			where: { id: { startsWith: 'test-comment-player-' } }
		});

		// Create test players
		testPlayer1 = await prisma.player.create({
			data: {
				id: 'test-comment-player-1',
				username: 'TestCommentUser1',
				imageUrl: 'https://example.com/avatar1.jpg',
				isAdmin: false
			}
		});

		testPlayer2 = await prisma.player.create({
			data: {
				id: 'test-comment-player-2',
				username: 'TestCommentUser2',
				imageUrl: 'https://example.com/avatar2.jpg',
				isAdmin: false
			}
		});

		// Create test game config
		const testConfig = await prisma.gameConfig.create({
			data: {
				id: 'test-config-comments',
				minTurns: 2,
				maxTurns: 4,
				writingTimeout: '10m',
				drawingTimeout: '24h',
				gameTimeout: '7d'
			}
		});

		// Create test game
		testGame = await prisma.game.create({
			data: {
				id: 'test-game-comments',
				configId: testConfig.id,
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
			}
		});
	});

	describe('createComment', () => {
		it('should create a comment and return it with player data', async () => {
			const commentText = 'This is a test comment';

			const result = await createComment(testGame.id, testPlayer1.id, commentText);

			expect(result).toBeDefined();
			expect(result.text).toBe(commentText);
			expect(result.gameId).toBe(testGame.id);
			expect(result.playerId).toBe(testPlayer1.id);
			expect(result.player).toBeDefined();
			expect(result.player?.username).toBe('TestCommentUser1');
			expect(result.createdAt).toBeInstanceOf(Date);
			expect(result.updatedAt).toBeInstanceOf(Date);

			// Verify the comment was actually created in the database
			const dbComment = await prisma.comment.findUnique({
				where: { id: result.id },
				include: { player: true }
			});
			expect(dbComment).toBeDefined();
			expect(dbComment?.text).toBe(commentText);
		});
	});

	describe('getCommentsByGameId', () => {
		it('should return all comments for a game, ordered by createdAt, with player data', async () => {
			// Create test comments
			const comment1 = await createComment(testGame.id, testPlayer1.id, 'First comment');
			const comment2 = await createComment(testGame.id, testPlayer2.id, 'Second comment');

			const result = await getCommentsByGameId(testGame.id);

			expect(result).toHaveLength(2);

			// Should be ordered by createdAt (ascending)
			expect(result[0].id).toBe(comment1.id);
			expect(result[1].id).toBe(comment2.id);

			// Check first comment
			expect(result[0].text).toBe('First comment');
			expect(result[0].player?.username).toBe('TestCommentUser1');

			// Check second comment
			expect(result[1].text).toBe('Second comment');
			expect(result[1].player?.username).toBe('TestCommentUser2');

			// Verify dates are proper Date objects
			expect(result[0].createdAt).toBeInstanceOf(Date);
			expect(result[1].createdAt).toBeInstanceOf(Date);
		});

		it('should return an empty array if a game has no comments', async () => {
			// Create another game config
			const emptyGameConfig = await prisma.gameConfig.create({
				data: {
					id: 'test-config-no-comments',
					minTurns: 2,
					maxTurns: 4,
					writingTimeout: '10m',
					drawingTimeout: '24h',
					gameTimeout: '7d'
				}
			});

			// Create another game with no comments
			const emptyGame = await prisma.game.create({
				data: {
					id: 'test-game-no-comments',
					configId: emptyGameConfig.id,
					expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
				}
			});

			const result = await getCommentsByGameId(emptyGame.id);

			expect(result).toEqual([]);

			// Clean up
			await prisma.game.delete({ where: { id: emptyGame.id } });
			await prisma.gameConfig.delete({ where: { id: emptyGameConfig.id } });
		});
	});
});
