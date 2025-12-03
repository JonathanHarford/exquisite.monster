import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { logger } from '$lib/server/logger';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface StorageCleanupResult {
	cleaned: number;
	errors: number;
	totalSize: number;
	details: string[];
}

/**
 * Clean up temporary files in Supabase storage
 * Removes files that match temporary naming patterns and are older than specified age
 */
export async function cleanupTemporaryFiles(
	bucketName: string = 'epyc-storage',
	directory: string = 'turns',
	maxAgeHours: number = 24
): Promise<StorageCleanupResult> {
	const result: StorageCleanupResult = {
		cleaned: 0,
		errors: 0,
		totalSize: 0,
		details: []
	};

	try {
		logger.info(`Starting storage cleanup for ${bucketName}/${directory}`);

		// Get all image paths referenced in database for safety check
		const { findAllImagePaths } = await import('./gameService.js');
		const referencedPaths = await findAllImagePaths();
		const referencedFiles = new Set(
			referencedPaths
				.filter(path => path.includes(`${bucketName}/${directory}/`))
				.map(path => {
					// Extract just the filename from the full Supabase URL
					const match = path.match(new RegExp(`${bucketName}/${directory}/(.+)$`));
					return match ? match[1] : null;
				})
				.filter(Boolean) as string[]
		);

		logger.info(`Found ${referencedFiles.size} files referenced in database - will never delete these`);

		// List all files in the directory
		const { data: files, error: listError } = await supabase.storage
			.from(bucketName)
			.list(directory, {
				limit: 1000,
				sortBy: { column: 'created_at', order: 'desc' }
			});

		if (listError) {
			logger.error('Failed to list files for cleanup:', listError);
			result.errors++;
			result.details.push(`List error: ${listError.message}`);
			return result;
		}

		if (!files || files.length === 0) {
			logger.info(`No files found in ${bucketName}/${directory}`);
			result.details.push('No files found to clean');
			return result;
		}

		logger.info(`Found ${files.length} files in ${bucketName}/${directory}`);

		const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
		// VERY restrictive patterns to avoid deleting legitimate files
		// Only match files that are clearly browser-generated temporary files
		const tempFilePatterns = [
			/^temp_[0-9a-f]{13,}\.(jpg|jpeg|png|webp)$/i, // temp_19604415689b9914.jpeg (13+ hex chars)
			/^blob-[0-9a-f]{8,}-[0-9a-f]{4,}-[0-9a-f]{4,}-[0-9a-f]{4,}-[0-9a-f]{12,}\.(jpg|jpeg|png|webp)$/i, // UUID-style temp files
			/^tmp-[0-9]{13,}-[0-9a-f]{6,}\.(jpg|jpeg|png|webp)$/i, // tmp-timestamp-random pattern
			/^upload-[0-9]{13,}-[0-9a-f]{8,}\.(jpg|jpeg|png|webp)$/i // upload-timestamp-random pattern
		];

		const filesToDelete: string[] = [];

		for (const file of files) {
			// Skip directories
			if (!file.name || file.name.endsWith('/')) {
				continue;
			}

			// SAFETY CHECK: Never delete files referenced in database
			if (referencedFiles.has(file.name)) {
				logger.debug(`Skipping referenced file: ${file.name}`);
				continue;
			}

			// Check if file matches temporary patterns
			const isTemporaryFile = tempFilePatterns.some((pattern) => pattern.test(file.name));

			if (isTemporaryFile) {
				// Check file age
				const fileAge = file.created_at ? new Date(file.created_at) : new Date(0);
				
				if (fileAge < cutoffTime) {
					filesToDelete.push(`${directory}/${file.name}`);
					result.totalSize += file.metadata?.size || 0;
					
					logger.debug(`Marked for deletion: ${file.name} (created: ${fileAge.toISOString()})`);
				} else {
					logger.debug(`Skipping recent temp file: ${file.name} (created: ${fileAge.toISOString()})`);
				}
			}
		}

		logger.info(`Found ${filesToDelete.length} temporary files to delete`);

		if (filesToDelete.length === 0) {
			result.details.push('No temporary files older than threshold found');
			return result;
		}

		// Delete files in batches to avoid overwhelming the API
		const batchSize = 50;
		for (let i = 0; i < filesToDelete.length; i += batchSize) {
			const batch = filesToDelete.slice(i, i + batchSize);
			
			try {
				const { error: deleteError } = await supabase.storage
					.from(bucketName)
					.remove(batch);

				if (deleteError) {
					logger.error(`Failed to delete batch ${i}-${i + batch.length}:`, deleteError);
					result.errors += batch.length;
					result.details.push(`Batch delete error: ${deleteError.message}`);
				} else {
					result.cleaned += batch.length;
					result.details.push(`Deleted batch: ${batch.length} files`);
					logger.debug(`Successfully deleted batch of ${batch.length} files`);
				}
			} catch (error) {
				logger.error(`Exception during batch delete ${i}-${i + batch.length}:`, error);
				result.errors += batch.length;
				result.details.push(`Exception: ${error instanceof Error ? error.message : String(error)}`);
			}

			// Small delay between batches to be nice to the API
			if (i + batchSize < filesToDelete.length) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		logger.info(`Storage cleanup completed: ${result.cleaned} files cleaned, ${result.errors} errors, ${Math.round(result.totalSize / 1024)}KB freed`);

	} catch (error) {
		logger.error('Storage cleanup failed:', error);
		result.errors++;
		result.details.push(`Cleanup error: ${error instanceof Error ? error.message : String(error)}`);
	}

	return result;
}

/**
 * Clean up all orphaned files (files not referenced in database)
 * This is a more aggressive cleanup that should be run less frequently
 */
export async function cleanupOrphanedFiles(
	bucketName: string = 'epyc-storage',
	directory: string = 'turns',
	dryRun: boolean = true
): Promise<StorageCleanupResult> {
	const result: StorageCleanupResult = {
		cleaned: 0,
		errors: 0,
		totalSize: 0,
		details: []
	};

	try {
		// Import database services
		const { findAllImagePaths } = await import('./gameService.js');
		
		logger.info(`Starting orphaned files cleanup for ${bucketName}/${directory} (dry run: ${dryRun})`);

		// Get all image paths from database
		const referencedPaths = await findAllImagePaths();
		const referencedFiles = new Set(
			referencedPaths
				.filter(path => path.includes(`${bucketName}/${directory}/`))
				.map(path => {
					// Extract just the filename from the full Supabase URL
					const match = path.match(new RegExp(`${bucketName}/${directory}/(.+)$`));
					return match ? match[1] : null;
				})
				.filter(Boolean) as string[]
		);

		logger.info(`Found ${referencedFiles.size} files referenced in database`);

		// List all files in storage
		const { data: files, error: listError } = await supabase.storage
			.from(bucketName)
			.list(directory, {
				limit: 1000,
				sortBy: { column: 'created_at', order: 'asc' }
			});

		if (listError) {
			logger.error('Failed to list files for orphan cleanup:', listError);
			result.errors++;
			result.details.push(`List error: ${listError.message}`);
			return result;
		}

		if (!files || files.length === 0) {
			result.details.push('No files found in storage');
			return result;
		}

		const orphanedFiles: string[] = [];

		for (const file of files) {
			// Skip directories
			if (!file.name || file.name.endsWith('/')) {
				continue;
			}

			if (!referencedFiles.has(file.name)) {
				orphanedFiles.push(`${directory}/${file.name}`);
				result.totalSize += file.metadata?.size || 0;
				logger.debug(`Found orphaned file: ${file.name}`);
			}
		}

		logger.info(`Found ${orphanedFiles.length} orphaned files`);

		if (orphanedFiles.length === 0) {
			result.details.push('No orphaned files found');
			return result;
		}

		if (dryRun) {
			result.details.push(`DRY RUN: Would delete ${orphanedFiles.length} orphaned files (${Math.round(result.totalSize / 1024)}KB)`);
			result.details.push(`Files: ${orphanedFiles.slice(0, 10).join(', ')}${orphanedFiles.length > 10 ? '...' : ''}`);
			return result;
		}

		// Actually delete the files
		const batchSize = 50;
		for (let i = 0; i < orphanedFiles.length; i += batchSize) {
			const batch = orphanedFiles.slice(i, i + batchSize);
			
			try {
				const { error: deleteError } = await supabase.storage
					.from(bucketName)
					.remove(batch);

				if (deleteError) {
					logger.error(`Failed to delete orphaned batch ${i}-${i + batch.length}:`, deleteError);
					result.errors += batch.length;
					result.details.push(`Orphaned batch delete error: ${deleteError.message}`);
				} else {
					result.cleaned += batch.length;
					result.details.push(`Deleted orphaned batch: ${batch.length} files`);
				}
			} catch (error) {
				logger.error(`Exception during orphaned batch delete:`, error);
				result.errors += batch.length;
				result.details.push(`Orphaned exception: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		logger.info(`Orphaned cleanup completed: ${result.cleaned} files cleaned, ${result.errors} errors`);

	} catch (error) {
		logger.error('Orphaned cleanup failed:', error);
		result.errors++;
		result.details.push(`Orphaned cleanup error: ${error instanceof Error ? error.message : String(error)}`);
	}

	return result;
}