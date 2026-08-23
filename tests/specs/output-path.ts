import path from 'node:path';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { deriveOutputPath, uniqueOutputPath } from '../../src/cli/output-path.ts';

describe('output-path', () => {
	describe('deriveOutputPath', () => {
		test('uses the trimmed common prefix of the two names', () => {
			expect(deriveOutputPath('logo-white.png', 'logo-black.png')).toBe('logo.png');
		});

		test('always outputs .png regardless of input extension', () => {
			expect(deriveOutputPath('shot-a.jpg', 'shot-b.jpg')).toBe('shot.png');
		});

		test('keeps the directory of the first input', () => {
			expect(deriveOutputPath('pics/logo-white.png', 'other/logo-black.png'))
				.toBe(path.join('pics', 'logo.png'));
		});

		test('falls back to the first name when there is no shared prefix', () => {
			expect(deriveOutputPath('alpha.png', 'beta.png')).toBe('alpha.png');
		});
	});

	describe('uniqueOutputPath', () => {
		test('returns the path unchanged when nothing is there', async () => {
			await using fixture = await createFixture({});
			const desired = fixture.getPath('logo.png');
			expect(uniqueOutputPath(desired)).toBe(desired);
		});

		test('appends an incrementing suffix to avoid collisions', async () => {
			await using fixture = await createFixture({
				'logo.png': 'x',
				'logo-1.png': 'x',
			});
			expect(uniqueOutputPath(fixture.getPath('logo.png')))
				.toBe(fixture.getPath('logo-2.png'));
		});
	});
});
