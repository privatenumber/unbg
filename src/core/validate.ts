import type { RgbaImage } from './types.ts';

/**
 * Asserts that an RGBA image is structurally sound: positive integer dimensions
 * backed by a pixel buffer of exactly `width * height * 4` bytes.
 *
 * The matting loop indexes the buffer by computed offsets, so a malformed image
 * would otherwise read out of bounds or average `undefined` into `NaN` colors
 * instead of failing loudly. Validating at the boundary keeps the algorithm
 * free of defensive per-pixel checks.
 */
export const validateRgbaImage = (
	image: RgbaImage,
	label: string,
): void => {
	const { data, width, height } = image;
	if (!(data instanceof Uint8Array)) {
		throw new TypeError(`${label}: data must be a Uint8Array`);
	}

	if (
		!Number.isSafeInteger(width)
		|| !Number.isSafeInteger(height)
		|| width <= 0
		|| height <= 0
	) {
		throw new Error(`${label}: width and height must be positive integers (received ${width}×${height})`);
	}

	const expectedLength = width * height * 4;
	if (!Number.isSafeInteger(expectedLength) || data.length !== expectedLength) {
		throw new Error(
			`${label}: data length ${data.length} does not match width and height (${width}×${height} needs ${expectedLength} bytes)`,
		);
	}
};
