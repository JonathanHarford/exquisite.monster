<script lang="ts">
	import { Avatar, Spinner, Alert } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import { useClerkContext } from 'svelte-clerk';
	import { applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		processProfilePicture,
		cleanupPreviewUrl,
		type ImageProcessingResult
	} from '$lib/client/imageProcessor.js';
	import { FILE_UPLOAD, formatFileSize } from '$lib/constants.js';

	interface Props {
		currentImageUrl?: string;
		username: string;
	}

	const { currentImageUrl, username }: Props = $props();
	const clerkContext = useClerkContext();

	// State management
	let isUploading = $state(false);
	let isProcessing = $state(false);
	let isDragOver = $state(false);
	// svelte-ignore state_referenced_locally
	let previewUrl = $state(currentImageUrl);

	$effect(() => {
		previewUrl = currentImageUrl;
	});

	let uploadError = $state<string | null>(null);
	let uploadSuccess = $state(false);
	let processedFile: File | null = $state(null);
	let fileInput: HTMLInputElement;
	let form: HTMLFormElement;

	// Constants
	const MAX_FILE_SIZE = FILE_UPLOAD.MAX_PROFILE_FILE_SIZE;
	const ACCEPTED_TYPES = FILE_UPLOAD.ACCEPTED_IMAGE_TYPES;
	const UPLOAD_TIMEOUT = 30000; // 30 seconds

	// Clear messages after a delay
	const clearMessages = () => {
		setTimeout(() => {
			uploadError = null;
			uploadSuccess = false;
		}, 5000);
	};

	// Function to refresh avatar data
	const refreshAvatarData = async () => {
		try {
			// Refresh Clerk user data
			await clerkContext.clerk?.user?.reload();
			// Invalidate all data to refetch from server
			await invalidateAll();
		} catch (error) {
			console.warn('Failed to refresh avatar data:', error);
		}
	};

	// Enhanced file validation
	const validateFile = (file: File): string | null => {
		if (
			!ACCEPTED_TYPES.includes(file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')
		) {
			return 'Invalid file type. Please choose a JPEG, PNG, WebP, or GIF image.';
		}

		if (file.size > MAX_FILE_SIZE) {
			const sizeMB = formatFileSize(MAX_FILE_SIZE);
			return `File is too large. Please choose a smaller image (max ${sizeMB}).`;
		}

		if (file.size === 0) {
			return 'File appears to be empty. Please choose a valid image file.';
		}

		return null;
	};

	// Process image using client-side processor
	const processImage = async (file: File): Promise<ImageProcessingResult> => {
		isProcessing = true;
		try {
			const result = await processProfilePicture(file);
			return result;
		} finally {
			isProcessing = false;
		}
	};

	// Enhanced upload with timeout and better error handling
	const uploadFile = async (file: File): Promise<void> => {
		const formData = new FormData();
		formData.append('file', file);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

		try {
			const response = await fetch('?/uploadProfilePicture', {
				method: 'POST',
				body: formData,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			// Check if response is JSON or a redirect
			const contentType = response.headers.get('content-type');

			if (contentType && contentType.includes('application/json')) {
				// Handle JSON response
				const result = await response.json();
				await applyAction(result);

				if (result.type === 'failure') {
					throw new Error(result.data?.error || 'Upload failed');
				} else if (result.type === 'success') {
					uploadSuccess = true;
					await refreshAvatarData();
					clearMessages();
				}
			} else {
				// Handle redirect response (success case)
				if (response.redirected || response.status === 302 || response.status === 303) {
					uploadSuccess = true;
					await refreshAvatarData();
					window.location.href = response.url || '/account';
				} else if (!response.ok) {
					throw new Error(`Upload failed with status: ${response.status}`);
				} else {
					uploadSuccess = true;
					await refreshAvatarData();
					clearMessages();
				}
			}
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new Error('Upload timed out. Please try again with a smaller file.');
				}
				throw error;
			}
			throw new Error('Upload failed. Please try again.');
		}
	};

	// Handle file selection with comprehensive error handling
	const handleFileSelect = async (file: File) => {
		// Clear previous messages and processed file
		uploadError = null;
		uploadSuccess = false;
		processedFile = null;

		// Clean up previous preview if different from current
		if (previewUrl && previewUrl !== currentImageUrl) {
			cleanupPreviewUrl(previewUrl);
		}

		// Validate file
		const validationError = validateFile(file);
		if (validationError) {
			uploadError = validationError;
			previewUrl = currentImageUrl;
			clearMessages();
			return;
		}

		try {
			// Process image on client side
			const processingResult = await processImage(file);

			if (!processingResult.success) {
				uploadError = processingResult.error || 'Failed to process image';
				previewUrl = currentImageUrl;
				clearMessages();
				return;
			}

			// Set processed file and preview
			processedFile = processingResult.file;
			previewUrl = processingResult.previewUrl ?? undefined;

			// Upload processed file
			if (processedFile) {
				isUploading = true;
				await uploadFile(processedFile);
			}
		} catch (error) {
			// Reset preview on error
			previewUrl = currentImageUrl;
			uploadError = error instanceof Error ? error.message : 'Upload failed. Please try again.';
			clearMessages();
		} finally {
			isUploading = false;
			// Clear file input to allow re-uploading the same file
			if (fileInput) {
				fileInput.value = '';
			}
		}
	};

	// Handle file input change
	const handleFileInputChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	// Enhanced drag and drop with better event handling
	const handleDragOver = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();

		// Only show drag state if we have files
		if (event.dataTransfer?.types.includes('Files')) {
			isDragOver = true;
		}
	};

	const handleDragEnter = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();

		if (event.dataTransfer?.types.includes('Files')) {
			isDragOver = true;
		}
	};

	const handleDragLeave = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();

		// Only hide if we're leaving the label entirely
		const label = event.currentTarget as HTMLElement;
		if (!event.relatedTarget || !label.contains(event.relatedTarget as Node)) {
			isDragOver = false;
		}
	};

	const handleDrop = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	// Handle keyboard navigation
	const handleKeyDown = (event: KeyboardEvent) => {
		if ((event.key === 'Enter' || event.key === ' ') && !isUploading && !isProcessing) {
			event.preventDefault();
			fileInput.click();
		}
	};

	// Cleanup on component destroy
	onMount(() => {
		return () => {
			if (previewUrl && previewUrl !== currentImageUrl) {
				cleanupPreviewUrl(previewUrl);
			}
		};
	});
</script>

<div class="profile-picture-upload">
	<!-- Error/Success Messages -->
	{#if uploadError}
		<div class="mb-4">
			<Alert color="red" dismissable>
				<span class="font-medium">Upload Error:</span>
				{uploadError}
			</Alert>
		</div>
	{/if}

	{#if uploadSuccess}
		<div class="mb-4">
			<Alert color="green" dismissable>
				<span class="font-medium">Success!</span> Profile picture updated successfully.
			</Alert>
		</div>
	{/if}

	<div class="flex flex-col items-center">
		<div class="group relative">
			<Avatar
				src={previewUrl}
				alt={`${username}'s profile picture`}
				size="xl"
				class={`ring-4 ring-primary-100 transition-all duration-200 group-hover:ring-primary-300 ${isDragOver ? 'ring-primary-300' : ''} ${isUploading || isProcessing ? 'opacity-75' : ''}`}
			/>

			<!-- Upload overlay -->
			<div
				class="upload-overlay absolute inset-0 transition-opacity duration-200"
				class:opacity-0={!isDragOver && !isUploading && !isProcessing}
				class:opacity-100={isDragOver}
				class:group-hover:opacity-100={!isDragOver && !isUploading && !isProcessing}
				ondragover={handleDragOver}
				ondragenter={handleDragEnter}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
				onkeydown={handleKeyDown}
				tabindex="0"
				role="button"
				aria-label="Upload profile picture"
				aria-describedby="upload-instructions"
			>
				<label
					for="profile-picture-input"
					class="upload-label flex h-full w-full cursor-pointer items-center justify-center"
					class:cursor-not-allowed={isUploading || isProcessing}
				>
					<div class="upload-message">
						{#if isProcessing}
							<div class="flex flex-col items-center text-white">
								<Spinner color="white" class="mb-1" size="6" />
								<span class="text-sm">Processing...</span>
							</div>
						{:else if isUploading}
							<div class="flex flex-col items-center text-white">
								<Spinner color="white" class="mb-1" size="6" />
								<span class="text-sm">Uploading...</span>
							</div>
						{:else if isDragOver}
							<div class="flex flex-col items-center text-white">
								<iconify-icon
									icon="material-symbols:cloud-upload"
									class="mb-1 h-6 w-6"
									aria-hidden="true"
								></iconify-icon>
								<span class="text-sm">Drop to Upload</span>
							</div>
						{:else}
							<div class="flex flex-col items-center text-white">
								<iconify-icon
									icon="material-symbols:camera-alt"
									class="mb-1 h-6 w-6"
									aria-hidden="true"
								></iconify-icon>
								<span class="text-sm">Change Photo</span>
							</div>
						{/if}
					</div>
				</label>

				<form
					bind:this={form}
					method="POST"
					action="?/uploadProfilePicture"
					enctype="multipart/form-data"
					class="hidden"
				>
					<input
						bind:this={fileInput}
						id="profile-picture-input"
						name="file"
						type="file"
						accept={ACCEPTED_TYPES.join(',')}
						onchange={handleFileInputChange}
						class="sr-only"
						disabled={isUploading || isProcessing}
						aria-label="Select profile picture file"
					/>
				</form>
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	.upload-overlay {
		@apply rounded-full bg-black bg-opacity-50;
	}

	.upload-label {
		@apply rounded-full;
	}

	.upload-overlay .upload-message {
		@apply flex flex-col items-center text-white;
	}

	.upload-label:focus {
		@apply outline-none ring-2 ring-primary-500 ring-offset-2;
	}
</style>
