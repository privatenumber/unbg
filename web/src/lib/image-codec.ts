/**
 * Browser-side image decode and PNG encode for unbg.
 *
 * Difference matting needs exact, unpremultiplied 8-bit RGBA pixels. We decode
 * with `createImageBitmap` (requesting no color-space conversion and no alpha
 * premultiplication) and read the pixels back through a 2D canvas, which always
 * normalizes supported image formats to 8-bit RGBA.
 */

import type { RgbaImage } from './core.ts';

export type DecodedImage = {
	image: RgbaImage;
	preview: Blob;
};

const previewMaximumDimension = 1024;

const createCanvas = (width: number, height: number) => {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
	canvas.toBlob(
		(blob) => {
			if (blob) {
				resolve(blob);
			} else {
				reject(new Error('Failed to encode PNG'));
			}
		},
		'image/png',
	);
});

const getPreviewDimensions = (width: number, height: number) => {
	const scale = Math.min(1, previewMaximumDimension / Math.max(width, height));
	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
	};
};

export const decodeImage = async (source: Blob): Promise<DecodedImage> => {
	const bitmap = await createImageBitmap(source, {
		colorSpaceConversion: 'none',
		premultiplyAlpha: 'none',
	});

	try {
		const { width, height } = bitmap;
		if (width === 0 || height === 0) {
			throw new Error('Image has no pixels');
		}

		const canvas = createCanvas(width, height);
		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) {
			throw new Error('Could not acquire a 2D canvas context');
		}

		context.drawImage(bitmap, 0, 0);
		const { data } = context.getImageData(0, 0, width, height);
		const previewDimensions = getPreviewDimensions(width, height);
		const previewCanvas = createCanvas(previewDimensions.width, previewDimensions.height);
		const previewContext = previewCanvas.getContext('2d');
		if (!previewContext) {
			throw new Error('Could not acquire a preview canvas context');
		}

		previewContext.drawImage(bitmap, 0, 0, previewDimensions.width, previewDimensions.height);
		return {
			image: {
				// Reinterpret the clamped buffer as a plain Uint8Array (zero-copy) so it
				// matches the shape the core expects.
				data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
				width,
				height,
			},
			preview: await canvasToBlob(previewCanvas),
		};
	} finally {
		bitmap.close();
	}
};
