import sizeOf from 'image-size';
import { FILE_UPLOAD, validateAspectRatio, validateImageDimensions } from '../constants.js';

export interface ImageValidationResult {
	isValid: boolean;
	width?: number;
	height?: number;
	format?: string;
	error?: string;
}

/**
 * Validate image for game turns.
 * Checks format, dimensions, and aspect ratio.
 * Enforces max dimensions to prevent large files since we don't resize server-side anymore.
 */
export function validateImage(inputBuffer: Buffer): ImageValidationResult {
	try {
		const dimensions = sizeOf(inputBuffer);

		if (!dimensions.width || !dimensions.height || !dimensions.type) {
			return { isValid: false, error: 'Unable to determine image dimensions or format.' };
		}

		// Validate format
		const validFormats = FILE_UPLOAD.ACCEPTED_IMAGE_FORMATS as readonly string[];
		if (!validFormats.includes(dimensions.type)) {
			return { isValid: false, error: 'Unsupported image format.' };
		}

		// Validate dimensions (min/max)
		const dimValidation = validateImageDimensions(dimensions.width, dimensions.height);
		if (!dimValidation.isValid) {
			return {
				isValid: false,
				error: dimValidation.error,
				width: dimensions.width,
				height: dimensions.height,
				format: dimensions.type
			};
		}

		// Validate max dimensions (strict check since we rely on client resizing)
		if (
			dimensions.width > FILE_UPLOAD.TURN_IMAGE_MAX_WIDTH ||
			dimensions.height > FILE_UPLOAD.TURN_IMAGE_MAX_HEIGHT
		) {
			return {
				isValid: false,
				error: `Image is too large (${dimensions.width}x${dimensions.height}). Max allowed is ${FILE_UPLOAD.TURN_IMAGE_MAX_WIDTH}x${FILE_UPLOAD.TURN_IMAGE_MAX_HEIGHT}.`,
				width: dimensions.width,
				height: dimensions.height,
				format: dimensions.type
			};
		}

		// Validate aspect ratio
		const aspectValidation = validateAspectRatio(dimensions.width, dimensions.height);
		if (!aspectValidation.isValid) {
			return {
				isValid: false,
				error: aspectValidation.error,
				width: dimensions.width,
				height: dimensions.height,
				format: dimensions.type
			};
		}

		return {
			isValid: true,
			width: dimensions.width,
			height: dimensions.height,
			format: dimensions.type
		};
	} catch (e) {
		return { isValid: false, error: `Invalid image file: ${e instanceof Error ? e.message : String(e)}` };
	}
}

/**
 * Validate image for profile pictures.
 * Checks format and dimensions.
 * Does NOT enforce aspect ratio (cropping handled at delivery).
 */
export function validateProfilePicture(inputBuffer: Buffer): ImageValidationResult {
	try {
		const dimensions = sizeOf(inputBuffer);

		if (!dimensions.width || !dimensions.height || !dimensions.type) {
			return { isValid: false, error: 'Unable to determine image dimensions or format.' };
		}

		// Validate format
		const validFormats = FILE_UPLOAD.ACCEPTED_IMAGE_FORMATS as readonly string[];
		if (!validFormats.includes(dimensions.type)) {
			return { isValid: false, error: 'Unsupported image format.' };
		}

		// Validate dimensions (min)
		const dimValidation = validateImageDimensions(dimensions.width, dimensions.height);
		if (!dimValidation.isValid) {
			return {
				isValid: false,
				error: dimValidation.error,
				width: dimensions.width,
				height: dimensions.height,
				format: dimensions.type
			};
		}

		// Validate max dimensions (strict check)
		if (
			dimensions.width > FILE_UPLOAD.PROFILE_IMAGE_MAX_WIDTH ||
			dimensions.height > FILE_UPLOAD.PROFILE_IMAGE_MAX_HEIGHT
		) {
			return {
				isValid: false,
				error: `Image is too large (${dimensions.width}x${dimensions.height}). Max allowed is ${FILE_UPLOAD.PROFILE_IMAGE_MAX_WIDTH}x${FILE_UPLOAD.PROFILE_IMAGE_MAX_HEIGHT}.`,
				width: dimensions.width,
				height: dimensions.height,
				format: dimensions.type
			};
		}

		return {
			isValid: true,
			width: dimensions.width,
			height: dimensions.height,
			format: dimensions.type
		};
	} catch (e) {
		return { isValid: false, error: `Invalid image file: ${e instanceof Error ? e.message : String(e)}` };
	}
}
