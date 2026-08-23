import type { RgbaImage } from './types.ts';
import { validateRgbaImage } from './validate.ts';

const findCropBounds = (image: RgbaImage, alphaThreshold: number) => {
	const { data, width, height } = image;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const alpha = data[((y * width) + x) * 4 + 3];
			if (alpha <= alphaThreshold) {
				continue;
			}

			if (x < minX) {
				minX = x;
			}
			if (y < minY) {
				minY = y;
			}
			if (x > maxX) {
				maxX = x;
			}
			if (y > maxY) {
				maxY = y;
			}
		}
	}

	if (maxX === -1) {
		return null;
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX + 1,
		height: maxY - minY + 1,
	};
};

export const validateCropThreshold = (threshold: number | undefined) => {
	if (threshold !== undefined && (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)) {
		throw new RangeError('Crop threshold must be between 0 and 1');
	}
};

/**
 * Crops transparent edges from an RGBA image without changing any retained
 * pixels. `threshold` is the minimum normalized alpha (0-1) that expands the
 * bounds, so it can exclude faint compression noise from the crop decision.
 */
export const cropTransparent = (
	image: RgbaImage,
	threshold = 0,
): RgbaImage => {
	validateRgbaImage(image, 'image');
	validateCropThreshold(threshold);

	const bounds = findCropBounds(image, threshold * 255);
	if (!bounds) {
		return {
			data: new Uint8Array(4),
			width: 1,
			height: 1,
		};
	}

	const { data, width, height } = image;
	const {
		x,
		y: top,
		width: croppedWidth,
		height: croppedHeight,
	} = bounds;
	if (croppedWidth === width && croppedHeight === height) {
		return image;
	}

	const cropped = new Uint8Array(croppedWidth * croppedHeight * 4);
	for (let row = 0; row < croppedHeight; row += 1) {
		const sourceOffset = (((top + row) * width) + x) * 4;
		cropped.set(
			data.subarray(sourceOffset, sourceOffset + (croppedWidth * 4)),
			row * croppedWidth * 4,
		);
	}

	return {
		data: cropped,
		width: croppedWidth,
		height: croppedHeight,
	};
};
