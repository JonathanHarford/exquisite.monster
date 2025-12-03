import sharp from 'sharp';
import { logger } from './logger.js';
import { FILE_UPLOAD, validateAspectRatio, validateImageDimensions } from '../constants.js';

export interface ImageOptimizationOptions {
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
	format?: 'webp' | 'jpeg' | 'png';
	generateSizes?: number[]; // Generate multiple sizes for responsive images
	cropToSquare?: boolean; // For profile pictures
}

export interface OptimizedImage {
	buffer: Buffer;
	format: string;
	width: number;
	height: number;
	size: number; // File size in bytes
}

export interface OptimizedImageSet {
	original: OptimizedImage;
	sizes?: { [key: string]: OptimizedImage }; // e.g., { "400": OptimizedImage, "800": OptimizedImage }
}

/**
 * Optimize an image using Sharp - main optimization function
 */
export async function optimizeImage(
	inputBuffer: Buffer,
	options: ImageOptimizationOptions = {}
): Promise<OptimizedImageSet> {
	const {
		maxWidth = 1024,
		maxHeight = 1024,
		quality = 85,
		format = 'webp',
		generateSizes = [],
		cropToSquare = false
	} = options;

	try {
		// Get original image metadata
		const metadata = await sharp(inputBuffer).metadata();
		logger.info(
			`Optimizing image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`
		);

		if (!metadata.width || !metadata.height) {
			throw new Error('Unable to determine image dimensions');
		}

		// Create the main optimized image
		let sharpInstance = sharp(inputBuffer);

		// Crop to square if requested (for profile pictures)
		if (cropToSquare) {
			const cropSize = Math.min(metadata.width, metadata.height);
			const left = Math.floor((metadata.width - cropSize) / 2);
			const top = Math.floor((metadata.height - cropSize) / 2);

			sharpInstance = sharpInstance.extract({
				left,
				top,
				width: cropSize,
				height: cropSize
			});
		}

		// Resize if needed while maintaining aspect ratio
		if (metadata.width > maxWidth || metadata.height > maxHeight) {
			sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
				fit: cropToSquare ? 'cover' : 'inside',
				withoutEnlargement: true
			});
		}

		// Apply format and quality settings
		switch (format) {
			case 'webp':
				sharpInstance = sharpInstance.webp({ quality });
				break;
			case 'jpeg':
				sharpInstance = sharpInstance.jpeg({ quality });
				break;
			case 'png':
				sharpInstance = sharpInstance.png({ quality });
				break;
		}

		// Generate the main optimized image
		const optimizedBuffer = await sharpInstance.toBuffer();
		const optimizedMetadata = await sharp(optimizedBuffer).metadata();

		const original: OptimizedImage = {
			buffer: optimizedBuffer,
			format: format,
			width: optimizedMetadata.width || 0,
			height: optimizedMetadata.height || 0,
			size: optimizedBuffer.length
		};

		const result: OptimizedImageSet = { original };

		// Generate additional sizes if requested
		if (generateSizes.length > 0) {
			result.sizes = {};

			for (const size of generateSizes) {
				// Only generate smaller sizes
				if (size < (optimizedMetadata.width || 0)) {
					let sizedInstance = sharp(inputBuffer);

					// Apply same cropping if it was used for the original
					if (cropToSquare) {
						const cropSize = Math.min(metadata.width, metadata.height);
						const left = Math.floor((metadata.width - cropSize) / 2);
						const top = Math.floor((metadata.height - cropSize) / 2);

						sizedInstance = sizedInstance
							.extract({ left, top, width: cropSize, height: cropSize })
							.resize(size, size, { fit: 'cover', withoutEnlargement: true });
					} else {
						sizedInstance = sizedInstance.resize(size, null, {
							fit: 'inside',
							withoutEnlargement: true
						});
					}

					const sizedBuffer = await sizedInstance.webp({ quality }).toBuffer();

					const sizedMetadata = await sharp(sizedBuffer).metadata();

					result.sizes[size.toString()] = {
						buffer: sizedBuffer,
						format: 'webp',
						width: sizedMetadata.width || 0,
						height: sizedMetadata.height || 0,
						size: sizedBuffer.length
					};
				}
			}
		}

		logger.info(
			`Image optimized: ${metadata.width}x${metadata.height} -> ${original.width}x${original.height}, ${Math.round(inputBuffer.length / 1024)}KB -> ${Math.round(original.size / 1024)}KB`
		);

		return result;
	} catch (error) {
		logger.error('Image optimization failed:', error);
		throw new Error(
			`Image optimization failed: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Optimize image for profile pictures (square, smaller sizes)
 */
export async function optimizeProfilePicture(inputBuffer: Buffer): Promise<OptimizedImageSet> {
	return optimizeImage(inputBuffer, {
		maxWidth: FILE_UPLOAD.PROFILE_IMAGE_MAX_WIDTH,
		maxHeight: FILE_UPLOAD.PROFILE_IMAGE_MAX_HEIGHT,
		quality: 90,
		format: 'webp',
		generateSizes: [...FILE_UPLOAD.PROFILE_IMAGE_RESPONSIVE_SIZES],
		cropToSquare: true
	});
}

/**
 * Optimize image for game turns (larger, with responsive sizes)
 */
export async function optimizeTurnImage(inputBuffer: Buffer): Promise<OptimizedImageSet> {
	return optimizeImage(inputBuffer, {
		maxWidth: FILE_UPLOAD.TURN_IMAGE_MAX_WIDTH,
		maxHeight: FILE_UPLOAD.TURN_IMAGE_MAX_HEIGHT,
		quality: FILE_UPLOAD.DEFAULT_WEBP_QUALITY,
		format: 'webp',
		generateSizes: [...FILE_UPLOAD.TURN_IMAGE_RESPONSIVE_SIZES]
	});
}

/**
 * Basic image validation - lighter version for server use
 * Assumes client has already done detailed validation
 */
export async function validateImage(inputBuffer: Buffer): Promise<{
	isValid: boolean;
	metadata?: sharp.Metadata;
	error?: string;
}> {
	try {
		const metadata = await sharp(inputBuffer).metadata();

		// Check if it's a valid image format
		if (
			!metadata.format ||
			!(FILE_UPLOAD.ACCEPTED_IMAGE_FORMATS as readonly string[]).includes(metadata.format)
		) {
			return {
				isValid: false,
				metadata,
				error: 'Unsupported image format. Please use JPEG, PNG, WebP, or GIF.'
			};
		}

		// Check dimensions exist
		if (!metadata.width || !metadata.height) {
			return {
				isValid: false,
				metadata,
				error: 'Unable to determine image dimensions.'
			};
		}

		// Basic dimension check (server-side safety check)
		const dimensionValidation = validateImageDimensions(metadata.width, metadata.height);
		if (!dimensionValidation.isValid) {
			return {
				isValid: false,
				metadata,
				error: dimensionValidation.error
			};
		}

		// Aspect ratio validation for non-profile images
		const aspectRatioValidation = validateAspectRatio(metadata.width, metadata.height);
		if (!aspectRatioValidation.isValid) {
			return {
				isValid: false,
				metadata,
				error: aspectRatioValidation.error
			};
		}

		return {
			isValid: true,
			metadata
		};
	} catch (error) {
		return {
			isValid: false,
			error: `Invalid image file: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

/**
 * Validate image file for profile pictures (no aspect ratio constraints since we crop to square)
 */
export async function validateProfilePictureImage(inputBuffer: Buffer): Promise<{
	isValid: boolean;
	metadata?: sharp.Metadata;
	error?: string;
}> {
	try {
		const metadata = await sharp(inputBuffer).metadata();

		// Check if it's a valid image format
		if (
			!metadata.format ||
			!(FILE_UPLOAD.ACCEPTED_IMAGE_FORMATS as readonly string[]).includes(metadata.format)
		) {
			return {
				isValid: false,
				metadata,
				error: 'Unsupported image format. Please use JPEG, PNG, WebP, or GIF.'
			};
		}

		// Check dimensions exist
		if (!metadata.width || !metadata.height) {
			return {
				isValid: false,
				metadata,
				error: 'Unable to determine image dimensions.'
			};
		}

		// Basic dimension check (both dimensions should be at least the minimum)
		const dimensionValidation = validateImageDimensions(metadata.width, metadata.height);
		if (!dimensionValidation.isValid) {
			return {
				isValid: false,
				metadata,
				error: dimensionValidation.error
			};
		}

		// No aspect ratio validation for profile pictures since we crop to square

		return {
			isValid: true,
			metadata
		};
	} catch (error) {
		return {
			isValid: false,
			error: `Invalid image file: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}
