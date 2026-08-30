import { describe, test, expect } from 'manten';
import { findCropBounds } from '../../../src/core/crop-transparent.ts';
import type { RgbaImage } from '../../src/lib/core.ts';
import { createCropMetadata, getCropBounds } from '../../src/lib/manual-crop-bounds.ts';

const image = (width: number, height: number, pixels: Array<[number, number, number]>) => {
	const data = new Uint8Array(width * height * 4);
	for (const [x, y, alpha] of pixels) {
		data[((y * width) + x) * 4 + 3] = alpha;
	}

	return {
		data,
		width,
		height,
	} satisfies RgbaImage;
};

describe('manual crop bounds', () => {
	test('matches alpha-threshold bounds for every 8-bit threshold', () => {
		const source = image(6, 5, [
			[0, 0, 1],
			[1, 1, 16],
			[2, 2, 64],
			[4, 3, 128],
			[5, 4, 255],
		]);
		const metadata = createCropMetadata(source);

		for (let threshold = 0; threshold <= 255; threshold += 1) {
			expect(getCropBounds(metadata, threshold / 255)).toStrictEqual(
				findCropBounds(source, threshold),
			);
		}
	});

	test('keeps automatic bounds separate from manual bounds', () => {
		const source = image(200, 200, [
			[0, 0, 1],
			[80, 80, 255],
		]);
		const metadata = createCropMetadata(source);

		expect(getCropBounds(metadata, true)).toStrictEqual({
			x: 80,
			y: 80,
			width: 1,
			height: 1,
		});
		expect(getCropBounds(metadata, 0)).toStrictEqual({
			x: 0,
			y: 0,
			width: 81,
			height: 81,
		});
	});
});
