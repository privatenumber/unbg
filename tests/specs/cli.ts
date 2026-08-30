import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { decodeImage } from '../../src/node/image-codec.ts';
import { composite, createScene, toPng } from '../utils/scene.ts';
import type { Rgb } from '../../src/core/types.ts';

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

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

const run = (...args: string[]) => execFileAsync(process.execPath, [cliPath, ...args]);

describe('cli', () => {
	test('writes a transparent PNG end-to-end', async () => {
		const width = 8;
		const height = 8;
		const foreground: Rgb = {
			r: 30,
			g: 144,
			b: 255,
		};
		const scene = createScene(width, height, foreground);

		await using fixture = await createFixture({
			'a.png': await toPng(composite(scene, white), width, height),
			'b.png': await toPng(composite(scene, black), width, height),
		});

		const outputPath = fixture.getPath('out.png');
		const { stderr } = await run(
			fixture.getPath('a.png'),
			fixture.getPath('b.png'),
			'--output',
			outputPath,
		);

		expect(stderr).toMatch('Background distance');
		expect(await fixture.exists('out.png')).toBe(true);

		const { width: outWidth, data } = await decodeImage(await fixture.readFile('out.png'));

		expect(outWidth).toBe(width);
		expect(data.length).toBe(width * height * 4);
		expect(data[3]).toBe(0);

		const centerOffset = (((height / 2) * width) + (width / 2)) * 4;
		expect(data[centerOffset + 3]).toBe(255);
	});

	test('derives the output name from the inputs and avoids collisions', async () => {
		const scene = createScene(6, 6, {
			r: 30,
			g: 144,
			b: 255,
		});

		await using fixture = await createFixture({
			'logo-white.png': await toPng(composite(scene, white), 6, 6),
			'logo-black.png': await toPng(composite(scene, black), 6, 6),
		});

		// First run derives `logo.png` from the shared `logo-` prefix
		const first = await run(fixture.getPath('logo-white.png'), fixture.getPath('logo-black.png'));
		expect(await fixture.exists('logo.png')).toBe(true);
		expect(first.stderr).toMatch('logo.png');

		// Second run collides → `logo-1.png`
		const second = await run(fixture.getPath('logo-white.png'), fixture.getPath('logo-black.png'));
		expect(await fixture.exists('logo-1.png')).toBe(true);
		expect(second.stderr).toMatch('logo-1.png');
	});

	test('exits with an error on mismatched dimensions', async () => {
		await using fixture = await createFixture({
			'a.png': await toPng(composite(createScene(4, 4, white), white), 4, 4),
			'b.png': await toPng(composite(createScene(6, 6, white), black), 6, 6),
		});

		let failure: { code?: number;
			stderr?: string; } | undefined;
		try {
			await run(
				fixture.getPath('a.png'),
				fixture.getPath('b.png'),
				'-o',
				fixture.getPath('out.png'),
			);
		} catch (error) {
			failure = error as { code?: number;
				stderr?: string; };
		}

		expect(failure?.code).toBe(1);
		expect(failure?.stderr).toMatch('same dimensions');
	});

	test('rejects out-of-range background colors', async () => {
		await using fixture = await createFixture({
			'a.png': await toPng(Buffer.from([200, 60, 40, 255]), 1, 1),
			'b.png': await toPng(Buffer.from([60, 100, 130, 255]), 1, 1),
		});

		let failure: { stderr?: string } | undefined;
		try {
			await run(
				fixture.getPath('a.png'),
				fixture.getPath('b.png'),
				'--background1',
				'256,0,0',
			);
		} catch (error) {
			failure = error as { stderr?: string };
		}

		expect(failure?.stderr).toMatch('Invalid color');
	});

	test('crops automatically or with an explicit numeric threshold', async () => {
		const width = 8;
		const height = 8;
		const scene = createScene(width, height, {
			r: 30,
			g: 144,
			b: 255,
		});
		await using fixture = await createFixture({
			'a.png': await toPng(composite(scene, white), width, height),
			'b.png': await toPng(composite(scene, black), width, height),
		});

		const booleanRun = await run(
			fixture.getPath('a.png'),
			fixture.getPath('b.png'),
			'--crop',
			'--output',
			fixture.getPath('boolean.png'),
		);
		const thresholdRun = await run(
			fixture.getPath('a.png'),
			fixture.getPath('b.png'),
			'--crop',
			'0.02',
			'--output',
			fixture.getPath('threshold.png'),
		);
		const clippingRun = await run(
			fixture.getPath('a.png'),
			fixture.getPath('b.png'),
			'--crop',
			'0.6',
			'--output',
			fixture.getPath('clipping.png'),
		);

		expect(booleanRun.stderr).toMatch('Crop mode: automatic edge-density');
		expect(thresholdRun.stderr).toMatch('Crop threshold: 0.020');
		expect(clippingRun.stderr).toMatch('Warning: crop threshold clips non-transparent edge pixels');

		const booleanResult = await decodeImage(await fixture.readFile('boolean.png'));
		const thresholdResult = await decodeImage(await fixture.readFile('threshold.png'));
		expect(booleanResult.width).toBe(6);
		expect(booleanResult.height).toBe(6);
		expect(thresholdResult.width).toBe(6);
		expect(thresholdResult.height).toBe(6);
		const clippingResult = await decodeImage(await fixture.readFile('clipping.png'));
		expect(clippingResult.width).toBe(4);
		expect(clippingResult.height).toBe(4);
	});

	test('accepts explicit crop disabling and numeric endpoints', async () => {
		const width = 8;
		const height = 8;
		const scene = createScene(width, height, {
			r: 30,
			g: 144,
			b: 255,
		});
		await using fixture = await createFixture({
			'a.png': await toPng(composite(scene, white), width, height),
			'b.png': await toPng(composite(scene, black), width, height),
		});

		await run(
			fixture.getPath('a.png'),
			fixture.getPath('b.png'),
			'--crop=false',
			'--output',
			fixture.getPath('disabled.png'),
		);
		await run(
			fixture.getPath('a.png'),
			fixture.getPath('b.png'),
			'--crop=0',
			'--output',
			fixture.getPath('zero.png'),
		);
		await run(
			fixture.getPath('a.png'),
			fixture.getPath('b.png'),
			'--crop=1',
			'--output',
			fixture.getPath('one.png'),
		);

		const disabled = await decodeImage(await fixture.readFile('disabled.png'));
		const zero = await decodeImage(await fixture.readFile('zero.png'));
		const one = await decodeImage(await fixture.readFile('one.png'));
		expect(disabled.width).toBe(8);
		expect(zero.width).toBe(6);
		expect(one.width).toBe(1);
	});

	test('rejects invalid crop values before reading images', async () => {
		for (const value of ['-0.1', '1.1', 'abc']) {
			let failure: {
				code?: number;
				stderr?: string;
			} | undefined;
			try {
				await run('first.png', 'second.png', `--crop=${value}`);
			} catch (error) {
				failure = error as {
					code?: number;
					stderr?: string;
				};
			}

			expect(failure?.code).toBe(1);
			expect(failure?.stderr).toMatch('Crop threshold must be between 0 and 1');
		}
	});
});
