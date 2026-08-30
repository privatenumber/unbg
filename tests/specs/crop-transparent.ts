import { describe, test, expect } from 'manten';
import {
	cropContent, cropTransparent, findCropClippingThreshold,
} from '../../src/core/crop-transparent.ts';
import { findContentBounds } from '../../src/core/find-content-bounds.ts';
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

	test('finds the first threshold that clips a nontransparent edge pixel', () => {
		const threshold = findCropClippingThreshold(image(4, 3, [
			[1, 0, 10, 20, 30, 5],
			[2, 0, 10, 20, 30, 255],
			[1, 1, 10, 20, 30, 5],
			[2, 1, 10, 20, 30, 255],
			[1, 2, 10, 20, 30, 5],
			[2, 2, 10, 20, 30, 255],
		]));

		expect(threshold).toBeCloseTo(5 / 255);
	});

	test('returns null when there are no nontransparent pixels', () => {
		expect(findCropClippingThreshold(image(2, 2, []))).toBe(null);
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

describe('cropContent', () => {
	test('trims sparse edge noise while retaining dense and soft content', () => {
		const width = 200;
		const height = 200;
		const data = new Uint8Array(width * height * 4);
		const setPixel = (x: number, y: number, alpha: number) => {
			const offset = ((y * width) + x) * 4;
			data[offset] = 10;
			data[offset + 1] = 20;
			data[offset + 2] = 30;
			data[offset + 3] = alpha;
		};

		for (let y = 80; y < 120; y += 1) {
			for (let x = 80; x < 100; x += 1) {
				setPixel(x, y, 255);
			}
			for (let x = 120; x < 140; x += 1) {
				setPixel(x, y, 255);
			}
			setPixel(79, y, 64);
			setPixel(140, y, 64);
		}
		setPixel(0, 0, 1);
		setPixel(width - 1, height - 1, 1);

		const source = {
			data,
			width,
			height,
		} satisfies RgbaImage;
		expect(findContentBounds(source)).toStrictEqual({
			x: 79,
			y: 80,
			width: 62,
			height: 40,
		});

		const result = cropContent(source);
		expect(result.width).toBe(62);
		expect(result.height).toBe(40);
		expect(result.data.subarray(0, 4)).toEqual(new Uint8Array([10, 20, 30, 64]));
		expect(result.data.subarray(-4)).toEqual(new Uint8Array([10, 20, 30, 64]));
	});

	test('returns a transparent pixel for an empty matte', () => {
		const source = image(2, 2, []);
		expect(findContentBounds(source)).toBe(null);
		expect(cropContent(source)).toStrictEqual({
			data: new Uint8Array(4),
			width: 1,
			height: 1,
		});
	});

	test('does not trim away the only foreground pixel', () => {
		const source = image(200, 200, [
			[0, 0, 10, 20, 30, 255],
		]);

		expect(findContentBounds(source)).toStrictEqual({
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		});
	});

	test('retains an edge at exactly 1% foreground density', () => {
		const width = 100;
		const height = 100;
		const data = new Uint8Array(width * height * 4);
		const setPixel = (x: number, y: number) => {
			data[((y * width) + x) * 4 + 3] = 255;
		};

		setPixel(50, 0);
		for (let y = 20; y < 80; y += 1) {
			for (let x = 20; x < 80; x += 1) {
				setPixel(x, y);
			}
		}

		expect(findContentBounds({
			data,
			width,
			height,
		})).toStrictEqual({
			x: 20,
			y: 0,
			width: 60,
			height: 80,
		});
	});

	test('keeps valid bounds for one- and two-pixel images', () => {
		expect(findContentBounds(image(1, 1, [[0, 0, 10, 20, 30, 255]]))).toStrictEqual({
			x: 0,
			y: 0,
			width: 1,
			height: 1,
		});
		expect(findContentBounds(image(2, 1, [[
			1, 0, 10, 20, 30, 255,
		]]))).toStrictEqual({
			x: 1,
			y: 0,
			width: 1,
			height: 1,
		});
	});
});
