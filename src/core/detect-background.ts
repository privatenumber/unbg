import { validateRgbaImage } from './validate.ts';
import type { Rgb, RgbaImage } from './types.ts';

/**
 * Estimates the solid background color of an RGBA image by averaging its four
 * corner pixels.
 *
 * Subjects in background-removal photos rarely reach into all four corners, so
 * the corners are a reliable sample of the background.
 */
export const detectBackground = (image: RgbaImage): Rgb => {
	validateRgbaImage(image, 'image');

	const { data, width, height } = image;
	const topRight = (width - 1) * 4;
	const bottomLeft = (height - 1) * width * 4;
	const bottomRight = ((height - 1) * width + (width - 1)) * 4;
	return {
		r: Math.round(
			(data[0] + data[topRight] + data[bottomLeft] + data[bottomRight]) / 4,
		),
		g: Math.round(
			(data[1] + data[topRight + 1] + data[bottomLeft + 1] + data[bottomRight + 1]) / 4,
		),
		b: Math.round(
			(data[2] + data[topRight + 2] + data[bottomLeft + 2] + data[bottomRight + 2]) / 4,
		),
	};
};
