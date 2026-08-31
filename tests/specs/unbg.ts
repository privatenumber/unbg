import { readFile } from 'node:fs/promises';
import { describe, test, expect } from 'manten';
import * as coreApi from '../../src/core/index.ts';
import { unbg } from '../../src/node/index.ts';
import * as nodeApi from '../../src/node/index.ts';
import { decodeImage } from '../../src/node/image-codec.ts';
import {
	composite, createScene, toJpeg, toPng,
} from '../utils/scene.ts';
import type { Rgb } from '../../src/core/types.ts';

const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

const white: Rgb = {
	r: 255,
	g: 255,
	b: 255,
};
const black: Rgb = {
	r: 0,
	g: 0,
	b: 0,
};

describe('unbg', () => {
	test('separates the Node and raw-pixel API surfaces', () => {
		expect(Object.keys(nodeApi)).toStrictEqual(['unbg']);
		expect(Object.keys(coreApi).sort()).toStrictEqual([
			'cropContent',
			'cropTransparent',
			'detectBackground',
			'differenceMatting',
		]);
	});

	test('extracts transparency from two PNG buffers', async () => {
		const width = 8;
		const height = 8;
		const foreground: Rgb = {
			r: 220,
			g: 30,
			b: 90,
		};
		const scene = createScene(width, height, foreground);

		const result = await unbg(
			new Uint8Array(await toPng(composite(scene, white), width, height)),
			new Uint8Array(await toPng(composite(scene, black), width, height)),
		);

		expect(result.width).toBe(width);
		expect(result.height).toBe(height);
		expect(result.background1).toEqual(white);
		expect(result.background2).toEqual(black);
		expect(result.backgroundDistance).toBeGreaterThan(440);
		expect(result.cropClippingThreshold).toBeGreaterThan(0);

		// The returned bytes are a real, writable PNG.
		expect(result.image).toBeInstanceOf(Uint8Array);
		expect(result.image.subarray(0, 8)).toEqual(pngSignature);

		const { data } = await decodeImage(result.image);
		expect(data.length).toBe(width * height * 4);

		// Corner is background → transparent
		expect(data[3]).toBe(0);

		// Center is opaque foreground
		const centerOffset = (((height / 2) * width) + (width / 2)) * 4;
		expect(data[centerOffset + 3]).toBe(255);
		expect(Math.abs(data[centerOffset] - foreground.r)).toBeLessThanOrEqual(3);
	});

	test('decodes PNG byte subarrays', async () => {
		const width = 8;
		const height = 8;
		const scene = createScene(width, height, {
			r: 220,
			g: 30,
			b: 90,
		});
		const [onWhite, onBlack] = await Promise.all([
			toPng(composite(scene, white), width, height),
			toPng(composite(scene, black), width, height),
		]);
		const whiteBytes = new Uint8Array(onWhite.length + 2);
		const blackBytes = new Uint8Array(onBlack.length + 2);
		whiteBytes.set(onWhite, 1);
		blackBytes.set(onBlack, 1);

		const result = await unbg(
			whiteBytes.subarray(1, -1),
			blackBytes.subarray(1, -1),
		);

		expect(result.width).toBe(width);
		expect(result.height).toBe(height);
	});

	test('accepts explicit background overrides', async () => {
		const background1: Rgb = {
			r: 250,
			g: 250,
			b: 250,
		};
		const background2: Rgb = {
			r: 5,
			g: 5,
			b: 5,
		};
		const onePixel = Buffer.from([100, 100, 100, 255]);

		const result = await unbg(
			await toPng(onePixel, 1, 1),
			await toPng(onePixel, 1, 1),
			{
				background1,
				background2,
			},
		);

		expect(result.background1).toEqual(background1);
		expect(result.background2).toEqual(background2);
	});

	test('crops transparent edges when requested', async () => {
		const width = 8;
		const height = 8;
		const scene = createScene(width, height, {
			r: 220,
			g: 30,
			b: 90,
		});
		const image1 = await toPng(composite(scene, white), width, height);
		const image2 = await toPng(composite(scene, black), width, height);

		const result = await unbg(image1, image2, { crop: true });

		expect(result.width).toBe(6);
		expect(result.height).toBe(6);
	});

	test('extracts transparency from two JPEG buffers', async () => {
		const width = 8;
		const height = 8;
		const scene = createScene(width, height, {
			r: 220,
			g: 30,
			b: 90,
		});

		const result = await unbg(
			await toJpeg(composite(scene, white), width, height),
			await toJpeg(composite(scene, black), width, height),
		);

		expect(result.width).toBe(width);
		expect(result.height).toBe(height);
		expect(result.image.subarray(0, 8)).toEqual(pngSignature);
	});

	test('extracts transparency from two WebP buffers', async () => {
		const result = await unbg(
			await readFile(new URL('../../.github/media/example-on-white.webp', import.meta.url)),
			await readFile(new URL('../../.github/media/example-on-black.webp', import.meta.url)),
		);

		expect(result.width).toBe(480);
		expect(result.height).toBe(480);
		expect(result.image.subarray(0, 8)).toEqual(pngSignature);
	});

	test('rejects unsupported input formats', async () => {
		let message: string | undefined;
		try {
			await unbg(Buffer.from('not an image'), Buffer.from('not an image'));
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toMatch('expected PNG, JPEG, or WebP');
	});

	test('rejects non-byte input', async () => {
		let message: string | undefined;
		try {
			await unbg('not image bytes' as never, 'not image bytes' as never);
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toBe('Expected image bytes as a Buffer or Uint8Array');
	});

	test('validates options before decoding', async () => {
		let message: string | undefined;
		try {
			await unbg(Buffer.from('not an image'), Buffer.from('not an image'), {
				channelThreshold: Number.NaN,
			});
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toMatch('channelThreshold');
	});

	test('validates crop thresholds before decoding', async () => {
		let message: string | undefined;
		try {
			await unbg(Buffer.from('not an image'), Buffer.from('not an image'), {
				crop: 1.1,
			});
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toMatch('Crop threshold');
	});

	test('rejects source transparency', async () => {
		let message: string | undefined;
		try {
			await unbg(
				await toPng(Buffer.from([100, 100, 100, 0]), 1, 1),
				await toPng(Buffer.from([100, 100, 100, 255]), 1, 1),
				{
					background1: white,
					background2: black,
				},
			);
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toBe('image1 must be fully opaque');
	});

	test('throws on mismatched dimensions', async () => {
		const small = await toPng(composite(createScene(4, 4, white), white), 4, 4);
		const large = await toPng(composite(createScene(6, 6, white), black), 6, 6);

		let message: string | undefined;
		try {
			await unbg(small, large);
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toMatch('same dimensions');
	});
});
