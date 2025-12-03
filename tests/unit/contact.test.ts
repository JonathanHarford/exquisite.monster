import { describe, it, expect } from 'vitest';
import { contactFormSchema } from '$lib/formSchemata';

describe('Contact Form Schema', () => {
	it('should validate a valid contact form', () => {
		const validData = {
			name: 'John Doe',
			email: 'john@example.com',
			subject: 'Test Subject',
			message: 'This is a test message that is long enough to pass validation.'
		};

		const result = contactFormSchema.safeParse(validData);
		expect(result.success).toBe(true);
	});

	it('should reject invalid email', () => {
		const invalidData = {
			name: 'John Doe',
			email: 'invalid-email',
			subject: 'Test Subject',
			message: 'This is a test message that is long enough to pass validation.'
		};

		const result = contactFormSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('email'))).toBe(true);
		}
	});

	it('should reject message that is too short', () => {
		const invalidData = {
			name: 'John Doe',
			email: 'john@example.com',
			subject: 'Test Subject',
			message: 'Short'
		};

		const result = contactFormSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('message'))).toBe(true);
		}
	});

	it('should reject empty required fields', () => {
		const invalidData = {
			name: '',
			email: '',
			subject: '',
			message: ''
		};

		const result = contactFormSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});

	it('should reject message that is too long', () => {
		const invalidData = {
			name: 'John Doe',
			email: 'john@example.com',
			subject: 'Test Subject',
			message: 'a'.repeat(2001) // Exceeds 2000 character limit
		};

		const result = contactFormSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('message'))).toBe(true);
		}
	});
});
