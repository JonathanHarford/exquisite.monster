// File upload and validation constants
export const FILE_UPLOAD = {
	// File size limits (in bytes)
	MAX_TURN_FILE_SIZE: 20 * 1024 * 1024, // 20MB
	MAX_PROFILE_FILE_SIZE: 10 * 1024 * 1024, // 10MB
	MAX_STORAGE_FILE_SIZE: 50 * 1024 * 1024, // 50MB (for storage service)

	// Accepted file types
	ACCEPTED_IMAGE_TYPES: [
		'image/jpeg',
		'image/jpg',
		'image/png',
		'image/webp',
		'image/gif'
	] as const,
	ACCEPTED_IMAGE_FORMATS: ['jpeg', 'jpg', 'png', 'webp', 'gif'] as const, // For Sharp metadata.format
	ACCEPTED_PDF_TYPE: 'application/pdf' as const,

	// Image dimension constraints
	MIN_IMAGE_WIDTH: 100,
	MIN_IMAGE_HEIGHT: 100,

	// Aspect ratio constraints
	MAX_ASPECT_RATIO: 2, // 2:1 (wide)
	MIN_ASPECT_RATIO: 0.5, // 1:2 (tall)

	// Canvas/processing dimensions
	CANVAS_MAX_WIDTH: 1920,
	CANVAS_MAX_HEIGHT: 1080,

	// Optimization settings
	DEFAULT_JPEG_QUALITY: 0.9,
	DEFAULT_WEBP_QUALITY: 85,

	// Turn image optimization
	TURN_IMAGE_MAX_WIDTH: 1920,
	TURN_IMAGE_MAX_HEIGHT: 1920,
	TURN_IMAGE_RESPONSIVE_SIZES: [400, 600, 800, 1024, 1920],

	// Profile picture optimization
	PROFILE_IMAGE_MAX_WIDTH: 512,
	PROFILE_IMAGE_MAX_HEIGHT: 512,
	PROFILE_IMAGE_RESPONSIVE_SIZES: [64, 128, 256, 512]
} as const;

// Derived constants for convenience
export const ACCEPTED_FILE_TYPES = [
	...FILE_UPLOAD.ACCEPTED_IMAGE_TYPES,
	FILE_UPLOAD.ACCEPTED_PDF_TYPE
] as const;

export const SETTINGS = {
	ACTIVE_GAME_COUNT_MIN: 20
};

// Helper functions
export const formatFileSize = (bytes: number): string => {
	return `${Math.round(bytes / (1024 * 1024))}MB`;
};

export const getAcceptedFileTypesString = (): string => {
	return ACCEPTED_FILE_TYPES.join(',');
};

export const validateAspectRatio = (
	width: number,
	height: number
): { isValid: boolean; error?: string } => {
	const aspectRatio = width / height;

	if (aspectRatio > FILE_UPLOAD.MAX_ASPECT_RATIO) {
		return {
			isValid: false,
			error: `Image is too wide. Maximum aspect ratio is ${FILE_UPLOAD.MAX_ASPECT_RATIO}:1.`
		};
	}

	if (aspectRatio < FILE_UPLOAD.MIN_ASPECT_RATIO) {
		return {
			isValid: false,
			error: `Image is too tall. Minimum aspect ratio is 1:${(1 / FILE_UPLOAD.MIN_ASPECT_RATIO).toFixed(1)}.`
		};
	}

	return { isValid: true };
};

export const validateImageDimensions = (
	width: number,
	height: number
): { isValid: boolean; error?: string } => {
	if (width < FILE_UPLOAD.MIN_IMAGE_WIDTH || height < FILE_UPLOAD.MIN_IMAGE_HEIGHT) {
		return {
			isValid: false,
			error: `Image must be at least ${FILE_UPLOAD.MIN_IMAGE_WIDTH}x${FILE_UPLOAD.MIN_IMAGE_HEIGHT} pixels.`
		};
	}

	return { isValid: true };
};
