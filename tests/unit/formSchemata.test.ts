import { describe, it, expect } from 'vitest';
import { gameConfigSchema, formToDb, dbToForm } from '$lib/formSchemata';
import type { GameConfig } from '@prisma/client';

describe('gameConfigSchema', () => {
	describe('validation', () => {
		it('should accept valid duration formats', () => {
			const validData = {
				maxTurns: 10,
				minTurns: 5,
				writingTimeout: '10m',
				drawingTimeout: '24h',
				gameTimeout: '7d'
			};

			const result = gameConfigSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should accept complex duration formats', () => {
			const validData = {
				maxTurns: null,
				minTurns: 8,
				writingTimeout: '2h30m',
				drawingTimeout: '1d12h',
				gameTimeout: '3d6h'
			};

			const result = gameConfigSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it('should reject invalid duration formats', () => {
			const invalidData = {
				maxTurns: 10,
				minTurns: 5,
				writingTimeout: 'invalid',
				drawingTimeout: '24h',
				gameTimeout: '7d'
			};

			const result = gameConfigSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toContain('Invalid duration format');
			}
		});

		it('should reject durations that are too short', () => {
			const invalidData = {
				maxTurns: 10,
				minTurns: 5,
				writingTimeout: '1s', // Too short (minimum is 5 seconds)
				drawingTimeout: '24h',
				gameTimeout: '7d'
			};

			const result = gameConfigSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it('should reject durations that are too long', () => {
			const invalidData = {
				maxTurns: 10,
				minTurns: 5,
				writingTimeout: '10m',
				drawingTimeout: '24h',
				gameTimeout: '8d' // Too long (maximum is 7 days)
			};

			const result = gameConfigSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});
	});

	describe('formToDb conversion', () => {
		it('should convert form data to database format', () => {
			const formData = {
				maxTurns: 10,
				minTurns: 5,
				writingTimeout: '10m',
				drawingTimeout: '24h',
				gameTimeout: '7d'
			};

			const dbData = formToDb(formData);

			expect(dbData.maxTurns).toBe(10);
			expect(dbData.minTurns).toBe(5);
			expect(dbData.writingTimeout).toBe('10m'); // Stored as duration string
			expect(dbData.drawingTimeout).toBe('24h'); // Stored as duration string
			expect(dbData.gameTimeout).toBe('7d'); // Stored as duration string
		});

		it('should handle complex durations', () => {
			const formData = {
				maxTurns: null,
				minTurns: 8,
				writingTimeout: '2h30m',
				drawingTimeout: '1d12h',
				gameTimeout: '3d6h'
			};

			const dbData = formToDb(formData);

			expect(dbData.maxTurns).toBe(null);
			expect(dbData.minTurns).toBe(8);
			expect(dbData.writingTimeout).toBe('2h30m'); // Stored as duration string
			expect(dbData.drawingTimeout).toBe('1d12h'); // Stored as duration string
			expect(dbData.gameTimeout).toBe('3d6h'); // Stored as duration string
		});
	});

	describe('dbToForm conversion', () => {
		it('should convert database data to form format', () => {
			const dbData: GameConfig = {
				id: 'test',
				maxTurns: 10,
				minTurns: 5,
				writingTimeout: '10m',
				drawingTimeout: '24h',
				gameTimeout: '7d',
				isLewd: false,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const formData = dbToForm(dbData);

			expect(formData.maxTurns).toBe(10);
			expect(formData.minTurns).toBe(5);
			expect(formData.writingTimeout).toBe('10m');
			expect(formData.drawingTimeout).toBe('1d'); // 24h is formatted as 1d (more concise)
			expect(formData.gameTimeout).toBe('7d');
		});

		it('should handle complex durations', () => {
			const dbData: GameConfig = {
				id: 'test',
				maxTurns: null,
				minTurns: 8,
				writingTimeout: '2h30m',
				drawingTimeout: '1d12h',
				gameTimeout: '3d6h',
				isLewd: false,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const formData = dbToForm(dbData);

			expect(formData.maxTurns).toBe(null);
			expect(formData.minTurns).toBe(8);
			expect(formData.writingTimeout).toBe('2h30m');
			expect(formData.drawingTimeout).toBe('1d12h');
			expect(formData.gameTimeout).toBe('3d6h');
		});
	});

	describe('round trip conversion', () => {
		it('should maintain data integrity through form->db->form conversion', () => {
			const originalFormData = {
				maxTurns: 15,
				minTurns: 6,
				writingTimeout: '1h30m',
				drawingTimeout: '2d',
				gameTimeout: '5d12h'
			};

			// Convert to DB format
			const dbData = formToDb(originalFormData);

			// Create a mock GameConfig object
			const mockGameConfig: GameConfig = {
				id: 'test',
				...dbData,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			// Convert back to form format
			const convertedFormData = dbToForm(mockGameConfig);

			expect(convertedFormData).toEqual(originalFormData);
		});
	});
});
