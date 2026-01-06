// import { dev } from '$app/environment';
// import fs from 'fs';
import { logger } from '$lib/server/logger';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import {
	validateImage,
	validateProfilePicture
} from './imageValidation';
// import { CACHE_CONFIGS, buildCacheControlHeader } from './cacheHeaders';
import { FILE_UPLOAD, formatFileSize } from '../constants';

// Initialize Supabase client
// We use the service role key for server-side operations like uploading files.
// The anon key is not strictly needed here for uploads but often used with the same client instance for other operations.
// If this client were only for uploads, SUPABASE_SERVICE_ROLE_KEY would suffice.
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const uploadToCloud = async (
	fileBuffer: Buffer,
	filename: string,
	directory: string = 'turns',
	contentType?: string
): Promise<{ path: string }> => {
	const bucketName = 'epyc-storage';
	const filePath = `${directory}/${filename}`;

	logger.info(`Uploading ${filename} to Supabase bucket ${bucketName} at ${filePath}`);

	// Use appropriate cache configuration for user images
	//const cacheControl = buildCacheControlHeader(CACHE_CONFIGS.USER_IMAGES);

	const { data, error } = await supabase.storage.from(bucketName).upload(filePath, fileBuffer, {
		// cacheControl, // Use our sophisticated cache configuration
		upsert: true, // Overwrite file if it exists
		contentType: contentType // Specify the MIME type
	});

	if (error) {
		logger.error(`Error uploading to Supabase`, error);
		throw new Error(`Supabase upload failed: ${error.message}`);
	}

	// Construct the public URL
	// Note: data.path is the path within the bucket, not the full public URL initially.
	// We need to get the public URL from Supabase.
	const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);

	if (!publicUrlData || !publicUrlData.publicUrl) {
		logger.error('Failed to get public URL from Supabase for path: ' + data.path);
		// Fallback or decide how to handle if public URL isn't available as expected
		// For now, let's assume it might be an issue or the path itself is used in some contexts
		// depending on bucket permissions. If direct public URLs are always needed, this is an error.
		// However, often the path is stored and URL constructed on retrieval or based on app logic.
		// For this function, we explicitly want to return the accessible public URL.
		throw new Error('Failed to retrieve public URL for uploaded file.');
	}

	logger.info(`File uploaded to Supabase. Public URL: ${publicUrlData.publicUrl}`);
	return { path: publicUrlData.publicUrl };
};

export async function upload(file: File, prefix: string): Promise<{ path: string }> {
	// Validate file type
	if (!file.type.startsWith('image/')) {
		throw new Error('File must be an image');
	}

	// Validate file size (max 50MB to match bucket config)
	if (file.size > FILE_UPLOAD.MAX_STORAGE_FILE_SIZE) {
		throw new Error(
			`File size must be less than ${formatFileSize(FILE_UPLOAD.MAX_STORAGE_FILE_SIZE)}`
		);
	}

	logger.info(`Uploading ${file.name} (${file.type}) as ${prefix}-${file.name}`);
	const fileBuffer = Buffer.from(await file.arrayBuffer());

	// Validate the image (no more server-side resizing)
	const validation = validateImage(fileBuffer);
	if (!validation.isValid) {
		throw new Error(validation.error || 'Invalid image file');
	}

	// Use original buffer
	// Detect format from validation or fallback to file.type
	// We want to preserve the extension if possible.
	// validateImage returns a format string from image-size (e.g. 'jpg', 'png').
	// file.type is mime type (e.g. 'image/jpeg').

	let extension = validation.format;
	if (extension === 'jpeg') extension = 'jpg'; // Normalize
	if (!extension) {
		// Fallback to extraction from filename if format detection failed but validation somehow passed (unlikely)
		extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
	}

	const contentType = file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

	// Create filename
	const baseFilename = file.name.replace(/\.[^/.]+$/, ''); // Remove original extension
	const filename = `${prefix}-${baseFilename}.${extension}`;

	return await uploadToCloud(fileBuffer, filename, 'turns', contentType);
}

/**
 * Upload a profile picture with specific validation and directory structure
 */
export async function uploadProfilePicture(file: File, userId: string): Promise<{ path: string }> {
	// Validate file type
	if (!file.type.startsWith('image/')) {
		throw new Error('File must be an image');
	}

	// Validate file size
	if (file.size > FILE_UPLOAD.MAX_PROFILE_FILE_SIZE) {
		throw new Error(
			`File size must be less than ${formatFileSize(FILE_UPLOAD.MAX_PROFILE_FILE_SIZE)}`
		);
	}

	const fileBuffer = Buffer.from(await file.arrayBuffer());

	// Validate the image for profile pictures
	const validation = validateProfilePicture(fileBuffer);
	if (!validation.isValid) {
		throw new Error(validation.error || 'Invalid image file');
	}

	// No optimization/cropping server-side

	let extension = validation.format;
	if (extension === 'jpeg') extension = 'jpg';
	if (!extension) {
		extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
	}

	const contentType = file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

	// Create filename with user ID, timestamp
	const timestamp = Date.now();
	const filename = `${userId}-${timestamp}.${extension}`;

	logger.info(
		`Uploading profile picture for user ${userId}: ${file.name} -> ${filename}`
	);

	return await uploadToCloud(fileBuffer, filename, 'profiles', contentType);
}
