import { existsSync } from 'node:fs';
import path from 'node:path';

const trimSeparators = (value: string) => value.replaceAll(/^[\s._-]+|[\s._-]+$/g, '');

const commonPrefix = (a: string, b: string) => {
	let length = 0;
	while (length < a.length && length < b.length && a[length] === b[length]) {
		length += 1;
	}

	return a.slice(0, length);
};

/**
 * Derives an output PNG path from two input image paths: the trimmed common
 * prefix of their file names (e.g. `logo-white.png` + `logo-black.png` →
 * `logo.png`), falling back to the first name when there's no shared prefix.
 * The result is placed beside the first input.
 */
export const deriveOutputPath = (
	image1: string,
	image2: string,
): string => {
	const name1 = path.parse(image1).name;
	const name2 = path.parse(image2).name;
	const shared = trimSeparators(commonPrefix(name1, name2));
	const base = shared || name1;

	return path.join(path.dirname(image1), `${base}.png`);
};

/**
 * Returns `desired` if no file is there, otherwise appends `-1`, `-2`, … before
 * the extension until the path no longer collides with an existing file.
 */
export const uniqueOutputPath = (desired: string): string => {
	if (!existsSync(desired)) {
		return desired;
	}

	const { dir, name, ext } = path.parse(desired);
	let counter = 1;
	let candidate = path.join(dir, `${name}-${counter}${ext}`);
	while (existsSync(candidate)) {
		counter += 1;
		candidate = path.join(dir, `${name}-${counter}${ext}`);
	}

	return candidate;
};
