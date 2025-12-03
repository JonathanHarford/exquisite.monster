import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	optimizeImage,
	optimizeProfilePicture,
	optimizeTurnImage,
	validateImage
} from '$lib/server/imageOptimization';
import sharp from 'sharp'; // Import sharp to create more realistic test images

// Mock logger
vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

describe('Image Optimization Service', () => {
	// Create a simple test image buffer (1x1 PNG)
	const createTestImageBuffer = (): Buffer => {
		// This is a minimal 1x1 transparent PNG
		const pngData = Buffer.from([
			0x89,
			0x50,
			0x4e,
			0x47,
			0x0d,
			0x0a,
			0x1a,
			0x0a, // PNG signature
			0x00,
			0x00,
			0x00,
			0x0d, // IHDR chunk length
			0x49,
			0x48,
			0x44,
			0x52, // IHDR
			0x00,
			0x00,
			0x00,
			0x01, // Width: 1
			0x00,
			0x00,
			0x00,
			0x01, // Height: 1
			0x08,
			0x06,
			0x00,
			0x00,
			0x00, // Bit depth, color type, compression, filter, interlace
			0x1f,
			0x15,
			0xc4,
			0x89, // CRC
			0x00,
			0x00,
			0x00,
			0x0a, // IDAT chunk length
			0x49,
			0x44,
			0x41,
			0x54, // IDAT
			0x78,
			0x9c,
			0x62,
			0x00,
			0x00,
			0x00,
			0x02,
			0x00,
			0x01, // Compressed data
			0xe2,
			0x21,
			0xbc,
			0x33, // CRC
			0x00,
			0x00,
			0x00,
			0x00, // IEND chunk length
			0x49,
			0x45,
			0x4e,
			0x44, // IEND
			0xae,
			0x42,
			0x60,
			0x82 // CRC
		]);
		return pngData;
	};

	// Create a larger test image buffer (200x200 PNG)
	const createLargerTestImageBuffer = async (): Promise<Buffer> => {
		// For testing, we'll use a simple approach - create a buffer that Sharp can process
		// In a real test, you might load an actual test image file
		// For robust testing, let's create actual image buffers using sharp
		// This creates a 200x200 red PNG image buffer
		return sharp({
			create: {
				width: 200,
				height: 200,
				channels: 3, // RGB
				background: { r: 255, g: 0, b: 0 } // Red
			}
		})
			.png()
			.toBuffer();
	};

	const createCustomSizeImageBuffer = async (
		width: number,
		height: number,
		format: 'png' | 'jpeg' = 'png'
	): Promise<Buffer> => {
		return sharp({
			create: {
				width,
				height,
				channels: 3,
				background: { r: 0, g: 255, b: 0 } // Green
			}
		})
			[format]()
			.toBuffer();
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('validateImage', () => {
		it('should validate a valid PNG image with correct size and aspect ratio', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(200, 200, 'png'); // 1:1 aspect ratio
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.metadata?.format).toBe('png');
			expect(result.metadata?.width).toBe(200);
			expect(result.metadata?.height).toBe(200);
		});

		it('should validate a valid JPEG image with correct size and aspect ratio', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(300, 150, 'jpeg'); // 2:1 aspect ratio
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.metadata?.format).toBe('jpeg');
			expect(result.metadata?.width).toBe(300);
			expect(result.metadata?.height).toBe(150);
		});

		it('should validate an image with max allowed aspect ratio (2:1)', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(400, 200); // 2:1
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(true);
		});

		it('should validate an image with min allowed aspect ratio (1:2)', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(200, 400); // 1:2
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(true);
		});

		it('should reject an image that is too wide (e.g., 2.1:1)', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(420, 200); // 2.1:1
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Image is too wide. Maximum aspect ratio is 2:1.');
		});

		it('should reject an image that is too tall (e.g., 1:2.1)', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(200, 420); // 1:2.1 (approx 0.476)
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Image is too tall. Minimum aspect ratio is 1:2.0.');
		});

		it('should reject non-image data', async () => {
			const textBuffer = Buffer.from('This is not an image');
			const result = await validateImage(textBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Invalid image file');
		});

		it('should reject images that are too small (e.g. 50x50)', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(50, 50);
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('must be at least 100x100 pixels');
		});

		// Original tests for small images, keeping them for sanity
		it('should validate a 1x1 PNG image (failing size and aspect ratio)', async () => {
			const imageBuffer = createTestImageBuffer(); // Original 1x1 PNG
			const result = await validateImage(imageBuffer);
			expect(result.isValid).toBe(false);
			// It should fail size validation first
			expect(result.error).toContain('must be at least 100x100 pixels');
		});

		it('should validate image format correctly even if other validations fail', async () => {
			const imageBuffer = createTestImageBuffer(); // Original 1x1 PNG
			const result = await validateImage(imageBuffer);
			expect(result.metadata).toBeDefined();
			expect(result.metadata?.format).toBe('png');
		});
	});

	describe('optimizeImage', () => {
		it('should optimize an image with default settings', async () => {
			const imageBuffer = await createLargerTestImageBuffer(); // 200x200 PNG
			const result = await optimizeImage(imageBuffer);

			expect(result.original).toBeDefined();
			expect(result.original.buffer).toBeInstanceOf(Buffer);
			expect(result.original.format).toBe('webp'); // Default format
			expect(result.original.width).toBe(200); // Should not resize if within limits
			expect(result.original.height).toBe(200);
			expect(result.original.size).toBeLessThan(imageBuffer.length); // WebP should be smaller
		});

		it('should resize image if it exceeds maxWidth or maxHeight', async () => {
			const largeImageBuffer = await createCustomSizeImageBuffer(1500, 1200); // Larger than default 1024x1024
			const result = await optimizeImage(largeImageBuffer, { maxWidth: 800, maxHeight: 600 });

			expect(result.original.width).toBeLessThanOrEqual(800);
			expect(result.original.height).toBeLessThanOrEqual(600);
			// Check if aspect ratio is maintained (approx 1500/1200 = 1.25)
			expect(result.original.width / result.original.height).toBeCloseTo(1500 / 1200, 2);
		});

		it('should generate multiple sizes when requested', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(1000, 800); // 1000x800
			const result = await optimizeImage(imageBuffer, { generateSizes: [400, 600] });

			expect(result.sizes).toBeDefined();
			expect(result.sizes!['400']).toBeDefined();
			expect(result.sizes!['400'].width).toBe(400); // Width should be 400
			// Height should maintain aspect ratio: 400 * (800/1000) = 320
			expect(result.sizes!['400'].height).toBe(320);

			expect(result.sizes!['600']).toBeDefined();
			expect(result.sizes!['600'].width).toBe(600); // Width should be 600
			// Height should maintain aspect ratio: 600 * (800/1000) = 480
			expect(result.sizes!['600'].height).toBe(480);
		});
	});

	describe('optimizeProfilePicture', () => {
		it('should optimize with profile picture settings', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(800, 600);
			const result = await optimizeProfilePicture(imageBuffer);

			expect(result.original.format).toBe('webp');
			expect(result.original.width).toBeLessThanOrEqual(512);
			expect(result.original.height).toBeLessThanOrEqual(512);

			expect(result.sizes).toBeDefined();
			expect(Object.keys(result.sizes!)).toEqual(expect.arrayContaining(['64', '128', '256']));
			expect(result.sizes!['256'].width).toBeLessThanOrEqual(256);
		});
	});

	describe('optimizeTurnImage', () => {
		it('should optimize with turn image settings', async () => {
			const imageBuffer = await createCustomSizeImageBuffer(1200, 900);
			const result = await optimizeTurnImage(imageBuffer);

			expect(result.original.format).toBe('webp');
			expect(result.original.width).toBeLessThanOrEqual(1920); // TURN_IMAGE_MAX_WIDTH
			expect(result.original.height).toBeLessThanOrEqual(1920); // TURN_IMAGE_MAX_HEIGHT

			expect(result.sizes).toBeDefined();
			expect(Object.keys(result.sizes!)).toEqual(expect.arrayContaining(['400', '600', '800']));
			expect(result.sizes!['800'].width).toBeLessThanOrEqual(800);
		});
	});

	describe('error handling', () => {
		it('should handle Sharp processing errors gracefully', async () => {
			const invalidBuffer = Buffer.from('invalid image data');

			await expect(optimizeImage(invalidBuffer)).rejects.toThrow('Image optimization failed');
		});
	});
});
