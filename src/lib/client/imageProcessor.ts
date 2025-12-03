import { FILE_UPLOAD, validateAspectRatio, validateImageDimensions } from '../constants.js';

export interface ImageProcessingResult {
	file: File | null;
	previewUrl: string | null;
	success: boolean;
	error?: string;
	metadata?: {
		originalWidth: number;
		originalHeight: number;
		processedWidth: number;
		processedHeight: number;
		originalSize: number;
		processedSize: number;
	};
}

export interface ImageProcessingOptions {
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
	outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
	cropToSquare?: boolean; // For profile pictures
	skipAspectRatioValidation?: boolean; // For profile pictures since they're cropped
}

/**
 * Process an image file with validation, resizing, and format conversion
 * Supports both regular images and profile pictures (with square cropping)
 */
export async function processImage(
	file: File,
	options: ImageProcessingOptions = {}
): Promise<ImageProcessingResult> {
	const {
		maxWidth = FILE_UPLOAD.CANVAS_MAX_WIDTH,
		maxHeight = FILE_UPLOAD.CANVAS_MAX_HEIGHT,
		quality = FILE_UPLOAD.DEFAULT_JPEG_QUALITY,
		outputFormat = 'image/jpeg',
		cropToSquare = false,
		skipAspectRatioValidation = false
	} = options;

	const result: ImageProcessingResult = {
		file: null,
		previewUrl: null,
		success: false
	};

	try {
		// Validate file type
		if (!file.type.startsWith('image/')) {
			result.error = 'Invalid file type. Please choose an image (JPG, PNG, GIF, WebP).';
			return result;
		}

		// Load image and get original dimensions
		const {
			canvas: processedCanvas,
			originalWidth,
			originalHeight
		} = await loadAndProcessImage(file, maxWidth, maxHeight, cropToSquare);

		// Validate dimensions
		const dimensionValidation = validateImageDimensions(
			processedCanvas.width,
			processedCanvas.height
		);
		if (!dimensionValidation.isValid) {
			result.error = dimensionValidation.error;
			return result;
		}

		// Validate aspect ratio (skip for profile pictures since they're cropped to square)
		if (!skipAspectRatioValidation) {
			const aspectRatioValidation = validateAspectRatio(
				processedCanvas.width,
				processedCanvas.height
			);
			if (!aspectRatioValidation.isValid) {
				result.error = aspectRatioValidation.error;
				return result;
			}
		}

		// Convert canvas to blob and create file
		const blob = await canvasToBlob(processedCanvas, outputFormat, quality);
		if (!blob) {
			result.error = 'Failed to convert processed image. Please try again.';
			return result;
		}

		// Create new file with processed image
		const outputFileName = getOutputFileName(file.name, outputFormat);
		result.file = new File([blob], outputFileName, {
			type: outputFormat,
			lastModified: Date.now()
		});

		// Create preview URL
		result.previewUrl = URL.createObjectURL(result.file);
		result.success = true;

		// Add metadata for debugging/logging
		result.metadata = {
			originalWidth,
			originalHeight,
			processedWidth: processedCanvas.width,
			processedHeight: processedCanvas.height,
			originalSize: file.size,
			processedSize: blob.size
		};
	} catch (error) {
		console.error('Image processing error:', error);
		result.error = 'Failed to process image. Please try a different file.';
	}

	return result;
}

/**
 * Process image specifically for profile pictures (square crop, smaller size)
 */
export async function processProfilePicture(file: File): Promise<ImageProcessingResult> {
	return processImage(file, {
		maxWidth: FILE_UPLOAD.PROFILE_IMAGE_MAX_WIDTH,
		maxHeight: FILE_UPLOAD.PROFILE_IMAGE_MAX_HEIGHT,
		quality: 0.9, // Higher quality for profile pictures
		outputFormat: 'image/webp',
		cropToSquare: true,
		skipAspectRatioValidation: true
	});
}

/**
 * Process image for game turns (larger size, aspect ratio validation)
 */
export async function processTurnImage(file: File): Promise<ImageProcessingResult> {
	return processImage(file, {
		maxWidth: FILE_UPLOAD.TURN_IMAGE_MAX_WIDTH,
		maxHeight: FILE_UPLOAD.TURN_IMAGE_MAX_HEIGHT,
		quality: FILE_UPLOAD.DEFAULT_JPEG_QUALITY,
		outputFormat: 'image/jpeg'
	});
}

/**
 * Process a canvas element (from PDF or image) into a standardized format
 */
export async function processCanvas(
	canvas: HTMLCanvasElement,
	fileName: string,
	options: ImageProcessingOptions = {}
): Promise<ImageProcessingResult> {
	const {
		maxWidth = FILE_UPLOAD.CANVAS_MAX_WIDTH,
		maxHeight = FILE_UPLOAD.CANVAS_MAX_HEIGHT,
		quality = FILE_UPLOAD.DEFAULT_JPEG_QUALITY,
		outputFormat = 'image/jpeg',
		cropToSquare = false,
		skipAspectRatioValidation = false
	} = options;

	const result: ImageProcessingResult = {
		file: null,
		previewUrl: null,
		success: false
	};

	try {
		// Crop to square if requested
		let processedCanvas = canvas;
		if (cropToSquare) {
			processedCanvas = cropCanvasToSquare(canvas);
		}

		// Validate aspect ratio (skip for profile pictures since they're cropped to square)
		if (!skipAspectRatioValidation) {
			const aspectRatioValidation = validateAspectRatio(
				processedCanvas.width,
				processedCanvas.height
			);
			if (!aspectRatioValidation.isValid) {
				result.error = aspectRatioValidation.error;
				return result;
			}
		}

		// Resize if needed
		processedCanvas = resizeCanvas(processedCanvas, maxWidth, maxHeight);

		// Convert to blob
		const blob = await canvasToBlob(processedCanvas, outputFormat, quality);
		if (!blob) {
			result.error = 'Failed to convert processed image. Please try again.';
			return result;
		}

		// Create file
		const outputFileName = getOutputFileName(fileName, outputFormat);
		result.file = new File([blob], outputFileName, {
			type: outputFormat,
			lastModified: Date.now()
		});

		result.previewUrl = URL.createObjectURL(result.file);
		result.success = true;

		// Add metadata
		result.metadata = {
			originalWidth: canvas.width,
			originalHeight: canvas.height,
			processedWidth: processedCanvas.width,
			processedHeight: processedCanvas.height,
			originalSize: 0, // Canvas doesn't have original file size
			processedSize: blob.size
		};
	} catch (error) {
		console.error('Canvas processing error:', error);
		result.error = 'Failed to process image. Please try again.';
	}

	return result;
}

/**
 * Clean up preview URLs to prevent memory leaks
 */
export function cleanupPreviewUrl(url: string | null): void {
	if (url) {
		URL.revokeObjectURL(url);
	}
}

// Private helper functions

async function loadAndProcessImage(
	file: File,
	maxWidth: number,
	maxHeight: number,
	cropToSquare: boolean = false
): Promise<{ canvas: HTMLCanvasElement; originalWidth: number; originalHeight: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');

				if (!ctx) {
					reject(new Error('Canvas not supported'));
					return;
				}

				const originalWidth = img.width;
				const originalHeight = img.height;
				let { width, height } = img;

				// Crop to square if requested (for profile pictures)
				if (cropToSquare) {
					const cropSize = Math.min(width, height);
					const sourceX = Math.floor((width - cropSize) / 2);
					const sourceY = Math.floor((height - cropSize) / 2);

					// Set canvas to square dimensions
					width = cropSize;
					height = cropSize;

					// Resize if the square is too large
					if (cropSize > maxWidth || cropSize > maxHeight) {
						const targetSize = Math.min(maxWidth, maxHeight);
						width = targetSize;
						height = targetSize;
					}

					canvas.width = width;
					canvas.height = height;
					ctx.drawImage(img, sourceX, sourceY, cropSize, cropSize, 0, 0, width, height);
				} else {
					// Regular resize maintaining aspect ratio
					if (width > maxWidth || height > maxHeight) {
						const ratio = Math.min(maxWidth / width, maxHeight / height);
						width = Math.round(width * ratio);
						height = Math.round(height * ratio);
					}

					canvas.width = width;
					canvas.height = height;
					ctx.drawImage(img, 0, 0, width, height);
				}

				resolve({ canvas, originalWidth, originalHeight });
			} catch (error) {
				reject(error);
			} finally {
				URL.revokeObjectURL(img.src);
			}
		};

		img.onerror = () => {
			URL.revokeObjectURL(img.src);
			reject(new Error('Failed to load image'));
		};

		img.src = URL.createObjectURL(file);
	});
}

function cropCanvasToSquare(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
	const { width, height } = sourceCanvas;
	const cropSize = Math.min(width, height);
	const sourceX = Math.floor((width - cropSize) / 2);
	const sourceY = Math.floor((height - cropSize) / 2);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Canvas not supported');
	}

	canvas.width = cropSize;
	canvas.height = cropSize;
	ctx.drawImage(sourceCanvas, sourceX, sourceY, cropSize, cropSize, 0, 0, cropSize, cropSize);

	return canvas;
}

function resizeCanvas(
	sourceCanvas: HTMLCanvasElement,
	maxWidth: number,
	maxHeight: number
): HTMLCanvasElement {
	let { width, height } = sourceCanvas;

	// Calculate new dimensions if needed
	if (width > maxWidth || height > maxHeight) {
		const ratio = Math.min(maxWidth / width, maxHeight / height);
		width = Math.round(width * ratio);
		height = Math.round(height * ratio);
	}

	// If no resize needed, return original
	if (width === sourceCanvas.width && height === sourceCanvas.height) {
		return sourceCanvas;
	}

	// Create new canvas with resized dimensions
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('Canvas not supported');
	}

	canvas.width = width;
	canvas.height = height;
	ctx.drawImage(sourceCanvas, 0, 0, width, height);

	return canvas;
}

async function canvasToBlob(
	canvas: HTMLCanvasElement,
	format: string,
	quality: number
): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob(resolve, format, quality);
	});
}

function getOutputFileName(originalName: string, format: string): string {
	const baseName = originalName.replace(/\.[^/.]+$/, '');
	const extension =
		format === 'image/jpeg'
			? 'jpg'
			: format === 'image/png'
				? 'png'
				: format === 'image/webp'
					? 'webp'
					: 'jpg';
	return `${baseName}.${extension}`;
}
