import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { FILE_UPLOAD } from '../constants';

// Initialize PDF.js worker
// Use the version from the actual package to ensure compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PDFProcessingResult {
	canvas: HTMLCanvasElement;
	fileName: string;
	success: boolean;
	error?: string;
}

/**
 * Process a PDF file and convert it to a canvas element
 */
export async function processPDF(file: File): Promise<PDFProcessingResult> {
	const result: PDFProcessingResult = {
		canvas: document.createElement('canvas'),
		fileName: file.name.replace(/\.pdf$/i, '.jpg'),
		success: false
	};

	try {
		// Validate file type
		if (file.type !== 'application/pdf') {
			result.error = 'File must be a PDF';
			return result;
		}

		const arrayBuffer = await file.arrayBuffer();
		const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

		// Validate single page requirement
		if (pdf.numPages !== 1) {
			result.error = 'PDF must be a single page.';
			return result;
		}

		const page = await pdf.getPage(1);

		// Calculate scale to fit within our canvas constraints while maintaining quality
		const viewport = page.getViewport({ scale: 1 });
		const scale = Math.min(
			FILE_UPLOAD.CANVAS_MAX_WIDTH / viewport.width,
			FILE_UPLOAD.CANVAS_MAX_HEIGHT / viewport.height,
			2 // Maximum scale for quality
		);

		const scaledViewport = page.getViewport({ scale });

		const ctx = result.canvas.getContext('2d');
		if (!ctx) {
			result.error = 'Canvas not supported. Please try a different browser.';
			return result;
		}

		result.canvas.width = scaledViewport.width;
		result.canvas.height = scaledViewport.height;

		const renderContext = {
			canvasContext: ctx,
			viewport: scaledViewport,
			canvas: result.canvas
		};

		await page.render(renderContext).promise;
		result.success = true;
	} catch (error) {
		console.error('PDF processing error:', error);
		result.error = 'Failed to process PDF. It might be corrupted or an unsupported format.';
	}

	return result;
}

/**
 * Check if PDF.js is properly initialized
 */
export function isPDFJSReady(): boolean {
	return (
		typeof pdfjsLib.GlobalWorkerOptions.workerSrc === 'string' &&
		pdfjsLib.GlobalWorkerOptions.workerSrc.length > 0
	);
}
