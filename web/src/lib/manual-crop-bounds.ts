import { findContentBounds, type ContentBounds, type RgbaImage } from './core.ts';
import type { CropMetadata, CropValue } from './matting-protocol.ts';

const boundsStride = 4;

const readBounds = (table: Int32Array, threshold: number): ContentBounds | null => {
	const offset = threshold * boundsStride;
	const width = table[offset + 2];
	if (width === 0) {
		return null;
	}

	return {
		x: table[offset],
		y: table[offset + 1],
		width,
		height: table[offset + 3],
	};
};

/** Builds all manual alpha bounds in one pass over the matte. */
export const createCropMetadata = (image: RgbaImage): CropMetadata => {
	const { data, width, height } = image;
	const minimumX = new Int32Array(256).fill(width);
	const minimumY = new Int32Array(256).fill(height);
	const maximumX = new Int32Array(256).fill(-1);
	const maximumY = new Int32Array(256).fill(-1);

	for (let offset = 0; offset < data.length; offset += 4) {
		const alpha = data[offset + 3];
		if (alpha === 0) {
			continue;
		}

		const pixel = offset / 4;
		const x = pixel % width;
		const y = Math.floor(pixel / width);
		minimumX[alpha] = Math.min(minimumX[alpha], x);
		minimumY[alpha] = Math.min(minimumY[alpha], y);
		maximumX[alpha] = Math.max(maximumX[alpha], x);
		maximumY[alpha] = Math.max(maximumY[alpha], y);
	}

	const manualBounds = new Int32Array(256 * boundsStride);
	let left = width;
	let top = height;
	let right = -1;
	let bottom = -1;
	for (let threshold = 255; threshold >= 0; threshold -= 1) {
		const alpha = threshold + 1;
		if (alpha <= 255) {
			left = Math.min(left, minimumX[alpha]);
			top = Math.min(top, minimumY[alpha]);
			right = Math.max(right, maximumX[alpha]);
			bottom = Math.max(bottom, maximumY[alpha]);
		}

		const offset = threshold * boundsStride;
		if (right < left || bottom < top) {
			manualBounds[offset + 2] = 0;
			continue;
		}

		manualBounds[offset] = left;
		manualBounds[offset + 1] = top;
		manualBounds[offset + 2] = right - left + 1;
		manualBounds[offset + 3] = bottom - top + 1;
	}

	return {
		width,
		height,
		automaticBounds: findContentBounds(image),
		manualBounds,
	};
};

/** Resolves a UI crop value to cached bounds. Undefined means cropping is off. */
export const getCropBounds = (
	metadata: CropMetadata,
	crop: CropValue,
): ContentBounds | null | undefined => {
	if (crop === false) {
		return undefined;
	}
	if (crop === true) {
		return metadata.automaticBounds;
	}

	const threshold = Math.max(0, Math.min(255, Math.floor(crop * 255)));
	return readBounds(metadata.manualBounds, threshold);
};
