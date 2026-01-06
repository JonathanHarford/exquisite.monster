import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateImage, validateProfilePicture } from '$lib/server/imageValidation';

// Mock logger
vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

// Mock image-size
vi.mock('image-size', () => {
    return {
        default: vi.fn()
    };
});

import sizeOf from 'image-size';

describe('Image Validation Service', () => {

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('validateImage', () => {
		it('should validate a valid PNG image with correct size and aspect ratio', () => {
            // Mock sizeOf to return valid dimensions
            vi.mocked(sizeOf).mockReturnValue({ width: 200, height: 200, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

			const imageBuffer = Buffer.from('fake-image');
			const result = validateImage(imageBuffer);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.format).toBe('png');
			expect(result.width).toBe(200);
			expect(result.height).toBe(200);
		});

		it('should validate a valid JPEG image with correct size and aspect ratio', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 300, height: 150, type: 'jpg' } as unknown as ReturnType<typeof sizeOf>);

			const imageBuffer = Buffer.from('fake-image');
			const result = validateImage(imageBuffer);

			expect(result.isValid).toBe(true);
			expect(result.format).toBe('jpg');
		});

		it('should validate an image with max allowed aspect ratio (2:1)', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 400, height: 200, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

			const imageBuffer = Buffer.from('fake-image');
			const result = validateImage(imageBuffer);
			expect(result.isValid).toBe(true);
		});

		it('should validate an image with min allowed aspect ratio (1:2)', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 200, height: 400, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

			const imageBuffer = Buffer.from('fake-image');
			const result = validateImage(imageBuffer);
			expect(result.isValid).toBe(true);
		});

		it('should reject an image that is too wide (e.g., 2.1:1)', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 420, height: 200, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

			const imageBuffer = Buffer.from('fake-image');
			const result = validateImage(imageBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Image is too wide. Maximum aspect ratio is 2:1.');
		});

		it('should reject an image that is too tall (e.g., 1:2.1)', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 200, height: 420, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

			const imageBuffer = Buffer.from('fake-image');
			const result = validateImage(imageBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Image is too tall. Minimum aspect ratio is 1:2.0.');
		});

        it('should reject an image that is too large (max dimensions)', () => {
            // MAX is 1920
            vi.mocked(sizeOf).mockReturnValue({ width: 2000, height: 2000, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

            const imageBuffer = Buffer.from('fake-image');
            const result = validateImage(imageBuffer);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Image is too large');
        });

		it('should reject non-image data (image-size throws)', () => {
            vi.mocked(sizeOf).mockImplementation(() => { throw new Error('Invalid type'); });

			const textBuffer = Buffer.from('This is not an image');
			const result = validateImage(textBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Invalid image file');
		});

		it('should reject images that are too small (e.g. 50x50)', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 50, height: 50, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

			const imageBuffer = Buffer.from('fake-image');
			const result = validateImage(imageBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('must be at least 100x100 pixels');
		});

        it('should reject unsupported formats', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 200, height: 200, type: 'bmp' } as unknown as ReturnType<typeof sizeOf>); // bmp not in list

            const imageBuffer = Buffer.from('fake-image');
            const result = validateImage(imageBuffer);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Unsupported image format');
        });
	});

	describe('validateProfilePicture', () => {
		it('should validate valid profile picture', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 200, height: 300, type: 'png' } as unknown as ReturnType<typeof sizeOf>); // Aspect ratio ignored

			const result = validateProfilePicture(Buffer.from('fake'));
			expect(result.isValid).toBe(true);
		});

        it('should reject too large profile picture', () => {
             // MAX is 512
            vi.mocked(sizeOf).mockReturnValue({ width: 600, height: 600, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

            const result = validateProfilePicture(Buffer.from('fake'));
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Image is too large');
        });

        it('should reject too small profile picture', () => {
            vi.mocked(sizeOf).mockReturnValue({ width: 50, height: 50, type: 'png' } as unknown as ReturnType<typeof sizeOf>);

            const result = validateProfilePicture(Buffer.from('fake'));
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('must be at least 100x100 pixels');
        });
	});
});
