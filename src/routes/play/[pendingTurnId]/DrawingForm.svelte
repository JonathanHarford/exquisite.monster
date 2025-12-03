<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$lib/appstate.svelte';
	import { Skvetchy } from 'skvetchy';
	import { applyAction, enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { Button } from 'flowbite-svelte';
	import { processPDF, type PDFProcessingResult } from '$lib/client/pdfProcessor';
	import {
		processTurnImage,
		processCanvas,
		cleanupPreviewUrl,
		type ImageProcessingResult
	} from '$lib/client/imageProcessor.js';
	import { FILE_UPLOAD, formatFileSize, getAcceptedFileTypesString } from '$lib/constants';
	import ErrorBox from '$lib/components/ErrorBox.svelte';
	import { page } from '$app/state';

	let mode: 'upload' | 'draw' = $state('upload');
	let skvetchyComponent: Skvetchy | null = $state(null);
	let selectedFile: File | null = $state(null);
	let fileInput: HTMLInputElement | null = $state(null);
	let previewUrl: string | null = $state(null);
	let isProcessing: boolean = $state(false);
	let processingError: string | null = $state(null);
	let originalFileName: string | null = $state(null);
	let hasEnteredDrawMode: boolean = $state(false);

	const isLewdGame = $derived(page.data.pendingGame?.isLewd || false);

	function clearError() {
		processingError = null;
	}

	function handleFileSelect(event: Event) {
		clearError();
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			originalFileName = file.name;

			// Basic validation
			if (!file.type.startsWith('image/') && file.type !== FILE_UPLOAD.ACCEPTED_PDF_TYPE) {
				processingError =
					'Invalid file type. Please choose an image (JPG, PNG, GIF, WebP) or a PDF file.';
				target.value = '';
				return;
			}

			if (file.size > FILE_UPLOAD.MAX_TURN_FILE_SIZE) {
				processingError = `File is too large. Please choose a smaller file (max ${formatFileSize(FILE_UPLOAD.MAX_TURN_FILE_SIZE)}).`;
				target.value = '';
				return;
			}

			if (file.type === FILE_UPLOAD.ACCEPTED_PDF_TYPE) {
				handlePDFFile(file);
			} else {
				handleImageFile(file);
			}
		} else {
			resetFileState();
		}
	}

	async function handlePDFFile(file: File) {
		isProcessing = true;
		processingError = null;

		try {
			const pdfResult: PDFProcessingResult = await processPDF(file);

			if (!pdfResult.success) {
				processingError = pdfResult.error || 'Failed to process PDF';
				isProcessing = false;
				if (fileInput) fileInput.value = '';
				return;
			}

			// Process the PDF canvas as an image
			const imageResult: ImageProcessingResult = await processCanvas(
				pdfResult.canvas,
				pdfResult.fileName
			);

			handleProcessingResult(imageResult);
		} catch (error) {
			console.error('PDF processing error:', error);
			processingError = 'Failed to process PDF. Please try again.';
			isProcessing = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function handleImageFile(file: File) {
		isProcessing = true;
		processingError = null;

		try {
			const result: ImageProcessingResult = await processTurnImage(file);
			handleProcessingResult(result);
		} catch (error) {
			console.error('Image processing error:', error);
			processingError = 'Failed to process image. Please try again.';
			isProcessing = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function handleProcessingResult(result: ImageProcessingResult) {
		if (!result.success) {
			processingError = result.error || 'Processing failed';
			isProcessing = false;
			if (fileInput) fileInput.value = '';
			return;
		}

		selectedFile = result.file;
		if (previewUrl) cleanupPreviewUrl(previewUrl);
		previewUrl = result.previewUrl;
		isProcessing = false;
	}

	function removeFile() {
		clearError();
		resetFileState();
	}

	function resetFileState() {
		selectedFile = null;
		if (fileInput) {
			fileInput.value = '';
		}
		if (previewUrl) {
			cleanupPreviewUrl(previewUrl);
			previewUrl = null;
		}
	}

	const enhanceForm = ({ formData }: { formData: FormData }) => {
		// If we have a resized file, replace the form data
		if (selectedFile) {
			formData.set('file', selectedFile);
		}

		appState.ui.loading = true;

		return async ({ result }: { result: ActionResult }) => {
			appState.ui.loading = false;
			await applyAction(result);
		};
	};

	async function handleSkvetchyExport() {
		if (skvetchyComponent) {
			appState.ui.loading = true;
			try {
				const blob = await skvetchyComponent.exportToPNG();
				if (blob) {
					const formData = new FormData();
					formData.append('file', blob, 'drawing.png');

					const response = await fetch('?/submitDrawing', {
						method: 'POST',
						body: formData
					});

					appState.ui.loading = false;
					const contentType = response.headers.get('content-type');

					if (contentType && contentType.includes('application/json')) {
						const result = await response.json();
						applyAction(result);
					} else {
						if (response.redirected || response.status === 302 || response.status === 303) {
							window.location.href = response.url || '/';
						} else {
							console.error('Unexpected response type:', response);
							alert(
								'Submission completed but response was unexpected. Please check if your drawing was submitted.'
							);
						}
					}
				}
			} catch (error) {
				appState.ui.loading = false;
				console.error('Skvetchy export or upload failed:', error);
				alert('Failed to export or upload drawing. Please try again.');
			}
		}
	}

	function switchMode(newMode: 'upload' | 'draw') {
		// Check if switching from skvetchy mode - show warning to prevent accidental loss
		if (mode === 'draw' && hasEnteredDrawMode && newMode === 'upload') {
			const shouldProceed = confirm(
				'If you switch to upload mode, your drawing will be lost. Continue?'
			);
			if (!shouldProceed) {
				return;
			}
		}

		// Clean up file selection when switching away from upload
		if (mode === 'upload') {
			removeFile();
		}

		// Track when user enters draw mode and reset when leaving
		if (newMode === 'draw') {
			hasEnteredDrawMode = true;
		} else if (mode === 'draw') {
			hasEnteredDrawMode = false;
		}

		mode = newMode;
	}

	// Clean up preview URL on component destroy
	onMount(() => {
		return () => {
			if (previewUrl) {
				cleanupPreviewUrl(previewUrl);
			}
		};
	});
</script>

{#if mode === 'upload'}
	<div class="upload-container">
		<form
			method="POST"
			action="?/submitDrawing"
			enctype="multipart/form-data"
			use:enhance={enhanceForm}
		>
			<div class="file-upload-area">
				<input
					bind:this={fileInput}
					type="file"
					name="file"
					accept={getAcceptedFileTypesString()}
					onchange={handleFileSelect}
					class="file-input"
					id="file-input"
					disabled={isProcessing}
				/>
				<label for="file-input" class="file-label" class:processing={isProcessing}>
					{#if isProcessing}
						<div class="processing-state">
							<svg class="processing-spinner" viewBox="0 0 24 24">
								<circle
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
									fill="none"
									stroke-dasharray="31.416"
									stroke-dashoffset="31.416"
								>
									<animate
										attributeName="stroke-dasharray"
										dur="2s"
										values="0 31.416;15.708 15.708;0 31.416"
										repeatCount="indefinite"
									/>
									<animate
										attributeName="stroke-dashoffset"
										dur="2s"
										values="0;-15.708;-31.416"
										repeatCount="indefinite"
									/>
								</circle>
							</svg>
							<span>Processing image...</span>
						</div>
					{:else if selectedFile}
						<div class="file-selected">
							<span class="file-name">{selectedFile.name}</span>
							<button type="button" onclick={removeFile} class="remove-file">×</button>
						</div>
					{:else}
						<div class="file-prompt">
							<svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
								></path>
							</svg>
							<span>Drop your image here, or click to upload</span>
							<span class="file-hint">
								<b>Accepted:</b> JPG, PNG, GIF, WebP, or 1-page PDF.
								<br />
								<b>Aspect Ratio:</b> Must be between 1:{1 / FILE_UPLOAD.MIN_ASPECT_RATIO} (taller) and
								{FILE_UPLOAD.MAX_ASPECT_RATIO}:1 (wider).
							</span>
						</div>
					{/if}
				</label>
			</div>

			<div class="flex justify-end">
				<button class="text-sm underline" onclick={() => switchMode('draw')}
					>Or would you rather draw in the browser? (Beta)</button
				>
			</div>
			{#if processingError}
				<ErrorBox><p>{processingError}</p></ErrorBox>
			{/if}

			{#if previewUrl}
				<div class="preview-container">
					<img src={previewUrl} alt="Preview" class="preview-image" />
				</div>
			{/if}

			{#if selectedFile && !isProcessing && !processingError}
				<div class="submit-container flex justify-center">
					<Button color="green" type="submit" disabled={appState.ui.loading}>
						{appState.ui.loading ? 'Submitting...' : 'Submit Drawing'}
					</Button>
				</div>
			{/if}
		</form>
	</div>
{/if}

{#if mode === 'draw'}
	<p>
		Look. I can't tell you how to live your life, but you'll have a much better experience if you
		draw on paper (or in an app) and upload a photo. <button
			class="inline text-sm underline"
			onclick={() => switchMode('upload')}>OK, take me back</button
		>
	</p>
	<div class="skvetchy-container">
		<Skvetchy
			bind:this={skvetchyComponent}
			imageWidth={FILE_UPLOAD.CANVAS_MAX_WIDTH}
			imageHeight={FILE_UPLOAD.CANVAS_MAX_HEIGHT}
			initialPenSize={15}
		/>
		<div class="flex justify-between">
			<div class="text-center text-sm text-primary-600">
				Tap pen/eraser icon a second time to change its size.
			</div>
			<button class="text-sm underline" onclick={() => switchMode('upload')}
				>But it's better to upload...</button
			>
		</div>
		<div class="mt-4 flex justify-center">
			<Button color="green" onclick={handleSkvetchyExport} disabled={appState.ui.loading}>
				{appState.ui.loading ? 'Submitting...' : 'Submit Drawing'}
			</Button>
		</div>
	</div>
{/if}

<section>
	<h3>Some Guidelines</h3>
	{#if mode === 'upload'}<p>
			Don't worry, you <b>can</b> close your browser while you create your art!
		</p>{/if}
	{#if mode === 'draw'}<p>
			If you must. I promise you'll get better results if you draw on paper and upload a photo!
		</p>{/if}
	<ol class="list">
		<li>
			{#if isLewdGame}
				<span class="text-red-500"
					>This is Exquisite Monster After Dark! Be as lewd as you want!</span
				>
			{:else}
				Keep it family friendly!
			{/if}
		</li>
		<li>Avoid words, letters, and numbers!</li>

		{#if mode === 'upload'}
			<li>
				You can draw on paper, use an app, or <i>get weird</i>. Sculpture, collage, and 3d renders
				are encouraged!
			</li>
			<li>If you're taking a photo of your art, light it well (avoid shadows!).</li>
			<li>
				If you're drawing on a tablet, we recommend <a
					href="https://procreate.art/"
					target="_blank"
					rel="noopener noreferrer">Procreate</a
				>
				and
				<a href="https://sketchbook.com/" target="_blank" rel="noopener noreferrer">Sketchbook</a>.
			</li>
			<li>
				You are welcome to use AI, but consider it a tool – don't just type the sentence into
				Midjourney. I mean, what would be the point?
			</li>
			<li>Please crop to just the picture.</li>
		{/if}
	</ol>
</section>

<style lang="postcss">
	.upload-container {
		@apply mt-4;
	}

	.file-upload-area {
		@apply relative;
	}

	.file-input {
		@apply absolute inset-0 h-full w-full cursor-pointer opacity-0;
	}

	.file-label {
		@apply flex cursor-pointer items-center justify-center rounded-lg border border-solid border-black transition-colors hover:bg-primary-50;
		min-height: 200px;
	}

	.file-label.processing {
		@apply cursor-not-allowed bg-primary-50;
	}

	.file-prompt {
		@apply flex flex-col items-center text-center;
	}

	.processing-state {
		@apply flex flex-col items-center text-center;
	}

	.processing-spinner {
		@apply mb-2 h-8 w-8 text-primary-500;
	}

	.upload-icon {
		@apply mb-2 h-12 w-12 text-primary-400;
	}

	.file-hint {
		@apply mt-1 text-sm text-primary-600;
	}

	.file-selected {
		@apply flex items-center gap-2 rounded bg-warning-100 p-4;
	}

	.file-name {
		@apply font-medium;
	}

	.remove-file {
		@apply flex h-6 w-6 items-center justify-center rounded-full bg-danger-500 text-white transition-colors hover:bg-danger-600;
	}

	.preview-container {
		@apply mt-4 flex justify-center;
	}

	.preview-image {
		@apply max-h-64 max-w-full rounded-lg border border-primary-300;
	}

	.submit-container {
		@apply mt-4;
	}
</style>
