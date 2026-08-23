import { describe, test, expect } from 'manten';
import { cropTransparent } from '../../src/core/crop-transparent.ts';
import type { RgbaImage } from '../../src/core/types.ts';

type Pixel = [number, number, number, number, number, number];

const image = (width: number, height: number, pixels: Pixel[]) => {
	const data = new Uint8Array(width * height * 4);
	for (const [x, y, r, g, b, alpha] of pixels) {
		const offset = ((y * width) + x) * 4;
		data[offset] = r;
		data[offset + 1] = g;
		data[offset + 2] = b;
		data[offset + 3] = alpha;
	}

	return {
		data,
		width,
		height,
	} satisfies RgbaImage;
};

describe('cropTransparent', () => {
	test('trims transparent edges while preserving the natural bounds', () => {
		const result = cropTransparent(image(4, 3, [
			[1, 0, 10, 20, 30, 255],
			[3, 2, 40, 50, 60, 128],
		]));

		expect(result.width).toBe(3);
		expect(result.height).toBe(3);
		expect(result.data.subarray(0, 4)).toEqual(new Uint8Array([10, 20, 30, 255]));
		expect(result.data.subarray(-4)).toEqual(new Uint8Array([40, 50, 60, 128]));
	});

	test('uses the threshold only to calculate crop bounds', () => {
		const result = cropTransparent(image(3, 2, [
			[0, 0, 10, 20, 30, 5],
			[2, 1, 40, 50, 60, 255],
		]), 0.1);

		expect(result.width).toBe(1);
		expect(result.height).toBe(1);
		expect(result.data).toEqual(new Uint8Array([40, 50, 60, 255]));
	});

	test('returns a transparent 1x1 image when no pixels qualify', () => {
		const result = cropTransparent(image(2, 2, []));

		expect(result.width).toBe(1);
		expect(result.height).toBe(1);
		expect(result.data).toEqual(new Uint8Array(4));
	});

	test('rejects thresholds outside the normalized alpha range', () => {
		expect(() => cropTransparent(image(1, 1, []), 1.1)).toThrow('between 0 and 1');
	});

	test('rejects malformed image data', () => {
		expect(() => cropTransparent({
			data: [0, 0, 0, 255] as never,
			width: 1,
			height: 1,
		})).toThrow('data must be a Uint8Array');
	});
});
