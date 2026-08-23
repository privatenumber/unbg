import { describe, test, expect } from 'manten';
import { differenceMatting } from '../../src/core/difference-matting.ts';
import { detectBackground } from '../../src/core/detect-background.ts';
import { composite, createScene, mix } from '../utils/scene.ts';
import type { Rgb, RgbaImage } from '../../src/core/types.ts';

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

/** Wraps a single solid color into a 1×1 opaque RGBA image. */
const pixel = (rgb: Rgb): RgbaImage => ({
	data: Buffer.from([rgb.r, rgb.g, rgb.b, 255]),
	width: 1,
	height: 1,
});

/** Wraps a raw RGBA buffer into an image of the given dimensions. */
const image = (data: Buffer, width: number, height: number): RgbaImage => ({
	data,
	width,
	height,
});

describe('difference-matting', () => {
	describe('detectBackground', () => {
		test('averages the four corner pixels', () => {
			// In a 2×2 image every pixel is a corner.
			const data = Buffer.from([
				0,
				0,
				0,
				255,
				100,
				100,
				100,
				255,
				200,
				200,
				200,
				255,
				40,
				40,
				40,
				255,
			]);

			// (0 + 100 + 200 + 40) / 4 = 85
			expect(detectBackground(image(data, 2, 2))).toEqual({
				r: 85,
				g: 85,
				b: 85,
			});
		});

		test('throws when the image is malformed', () => {
			expect(() => detectBackground(image(Buffer.alloc(4), 2, 2))).toThrow('does not match');
		});
	});

	describe('differenceMatting', () => {
		test('auto-detects backgrounds and recovers alpha + color', () => {
			const width = 6;
			const height = 6;
			const foreground: Rgb = {
				r: 200,
				g: 60,
				b: 40,
			};
			const scene = createScene(width, height, foreground);

			const result = differenceMatting(
				image(composite(scene, white), width, height),
				image(composite(scene, black), width, height),
			);

			expect(result.background1).toEqual(white);
			expect(result.background2).toEqual(black);

			for (let i = 0; i < scene.length; i += 1) {
				const offset = i * 4;
				const expectedAlpha = Math.round(scene[i].alpha * 255);
				expect(Math.abs(result.data[offset + 3] - expectedAlpha)).toBeLessThanOrEqual(2);

				// Foreground color is only meaningfully recoverable where alpha > 0
				if (scene[i].alpha > 0.01) {
					expect(Math.abs(result.data[offset] - foreground.r)).toBeLessThanOrEqual(3);
					expect(Math.abs(result.data[offset + 1] - foreground.g)).toBeLessThanOrEqual(3);
					expect(Math.abs(result.data[offset + 2] - foreground.b)).toBeLessThanOrEqual(3);
				}
			}
		});

		test('reports background distance', () => {
			const result = differenceMatting(pixel(white), pixel(black));
			expect(result.backgroundDistance).toBeCloseTo(Math.sqrt(3 * (255 ** 2)), 1);
		});

		test('rejects backgrounds without usable channels', () => {
			expect(() => differenceMatting(
				pixel({
					r: 100,
					g: 100,
					b: 100,
				}),
				pixel(black),
				{
					background1: {
						r: 5,
						g: 5,
						b: 5,
					},
					background2: black,
				},
			)).toThrow('No usable background channels');
		});

		test('floor snaps near-transparent alpha to 0', () => {
			const color: Rgb = {
				r: 100,
				g: 150,
				b: 200,
			};
			const result = differenceMatting(
				pixel(mix(color, white, 0.1)),
				pixel(mix(color, black, 0.1)),
				{
					background1: white,
					background2: black,
					floor: 0.2,
				},
			);

			expect(result.data[3]).toBe(0);
		});

		test('ceiling snaps near-opaque alpha to 255', () => {
			const color: Rgb = {
				r: 100,
				g: 150,
				b: 200,
			};
			const result = differenceMatting(
				pixel(mix(color, white, 0.9)),
				pixel(mix(color, black, 0.9)),
				{
					background1: white,
					background2: black,
					ceiling: 0.8,
				},
			);

			expect(result.data[3]).toBe(255);
		});

		test('uses channels whose background difference equals the channel threshold', () => {
			const color: Rgb = {
				r: 100,
				g: 150,
				b: 200,
			};
			const result = differenceMatting(
				pixel(mix(color, white, 0.5)),
				pixel(mix(color, black, 0.5)),
				{
					background1: white,
					background2: black,
					channelThreshold: 255,
				},
			);

			expect(Math.abs(result.data[3] - 128)).toBeLessThanOrEqual(2);
		});

		test('allows fractional background overrides and channel thresholds', () => {
			const background1: Rgb = {
				r: 254.5,
				g: 254.5,
				b: 254.5,
			};
			const result = differenceMatting(pixel(white), pixel(black), {
				background1,
				background2: black,
				channelThreshold: 254.5,
			});

			expect(result.background1).toEqual(background1);
		});

		test('rejects invalid options and background overrides', () => {
			expect(() => differenceMatting(pixel(white), pixel(black), {
				channelThreshold: Number.NaN,
			})).toThrow('channelThreshold');
			expect(() => differenceMatting(pixel(white), pixel(black), {
				floor: -0.1,
			})).toThrow('floor');
			expect(() => differenceMatting(pixel(white), pixel(black), {
				ceiling: 1.1,
			})).toThrow('ceiling');
			expect(() => differenceMatting(pixel(white), pixel(black), {
				floor: 0.8,
				ceiling: 0.2,
			})).toThrow('floor must not exceed ceiling');
			expect(() => differenceMatting(pixel(white), pixel(black), {
				background1: {
					r: -1,
					g: 0,
					b: 0,
				},
			})).toThrow('background1.r');
		});

		test('rejects transparent source images', () => {
			expect(() => differenceMatting({
				data: new Uint8Array([0, 0, 0, 0]),
				width: 1,
				height: 1,
			}, pixel(black), {
				background1: white,
				background2: black,
			})).toThrow('image1 must be fully opaque');
		});

		test('throws when the two images have different dimensions', () => {
			expect(() => differenceMatting(
				image(Buffer.alloc(1 * 1 * 4), 1, 1),
				image(Buffer.alloc(2 * 2 * 4), 2, 2),
			)).toThrow('same dimensions');
		});

		test('throws when an image buffer length does not match its dimensions', () => {
			expect(() => differenceMatting(
				image(Buffer.alloc(4), 2, 2),
				image(Buffer.alloc(2 * 2 * 4), 2, 2),
			)).toThrow('width and height');
		});

		test('throws when image data is not a Uint8Array', () => {
			expect(() => differenceMatting({
				data: [0, 0, 0, 255] as never,
				width: 1,
				height: 1,
			}, pixel(black))).toThrow('data must be a Uint8Array');
		});

		test('throws when dimensions are not positive integers', () => {
			expect(() => differenceMatting(
				image(Buffer.alloc(0), 0, 0),
				image(Buffer.alloc(0), 0, 0),
			)).toThrow('positive integers');
		});
	});
});
