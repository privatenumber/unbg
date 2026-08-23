import { readFile } from 'node:fs/promises';
import encodeJpeg, { init as initJpegEncoder } from '@jsquash/jpeg/encode.js';
import { encodeImage } from '../../src/node/image-codec.ts';
import type { Rgb } from '../../src/core/types.ts';

export type Pixel = {
	alpha: number;
	color: Rgb;
};

/** Alpha-composites a foreground color over a background (`obs = α·C + (1-α)·B`). */
export const mix = (
	color: Rgb,
	background: Rgb,
	alpha: number,
): Rgb => ({
	r: Math.round(alpha * color.r + (1 - alpha) * background.r),
	g: Math.round(alpha * color.g + (1 - alpha) * background.g),
	b: Math.round(alpha * color.b + (1 - alpha) * background.b),
});

/**
 * Builds a deterministic test scene: a transparent border (so the corners read
 * as background), a semi-transparent inner ring, and an opaque core.
 */
export const createScene = (
	width: number,
	height: number,
	foreground: Rgb,
): Pixel[] => {
	const pixels: Pixel[] = [];

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			// Distance to the nearest edge: 0 = border, 1 = inner ring, 2+ = core.
			const edgeDistance = Math.min(x, y, width - 1 - x, height - 1 - y);
			const alpha = [0, 0.5][edgeDistance] ?? 1;

			pixels.push({
				alpha,
				color: foreground,
			});
		}
	}

	return pixels;
};

/** Composites ground-truth pixels over a solid background into a raw, opaque RGBA buffer. */
export const composite = (
	pixels: Pixel[],
	background: Rgb,
): Buffer => {
	const data = Buffer.alloc(pixels.length * 4);

	for (let i = 0; i < pixels.length; i += 1) {
		const observed = mix(pixels[i].color, background, pixels[i].alpha);
		const offset = i * 4;
		data[offset] = observed.r;
		data[offset + 1] = observed.g;
		data[offset + 2] = observed.b;
		data[offset + 3] = 255;
	}

	return data;
};

/** Encodes a raw RGBA buffer into a lossless PNG Buffer for file fixtures. */
export const toPng = async (
	data: Buffer,
	width: number,
	height: number,
): Promise<Buffer> => Buffer.from(await encodeImage({
	data,
	width,
	height,
}));

let jpegEncoderReady: Promise<void> | undefined;

const initializeJpegEncoder = () => {
	if (!jpegEncoderReady) {
		jpegEncoderReady = (async () => {
			const wasm = await readFile(new URL(import.meta.resolve('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm')));
			await initJpegEncoder(await WebAssembly.compile(wasm));
		})();
	}

	return jpegEncoderReady;
};

/** Encodes raw RGBA pixels as JPEG to exercise the production JPEG decoder. */
export const toJpeg = async (
	data: Buffer,
	width: number,
	height: number,
): Promise<Buffer> => {
	await initializeJpegEncoder();
	const image = new ImageData(new Uint8ClampedArray(data), width, height);
	return Buffer.from(await encodeJpeg(image));
};
