import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cli } from 'cleye';
import { Float, Integer } from 'cleye/formats';
import packageJson from '../../package.json' with { type: 'json' };
import { unbg } from '../node/index.ts';
import type { Rgb } from '../core/index.ts';
import { parseColor } from './parse-color.ts';
import { parseCrop } from './parse-crop.ts';
import { deriveOutputPath, uniqueOutputPath } from './output-path.ts';

const formatRgb = ({ r, g, b }: Rgb) => `rgb(${r}, ${g}, ${b})`;

const formatBytes = (bytes: number) => {
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}

	return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
};

const argv = cli({
	name: 'unbg',

	version: packageJson.version,

	parameters: ['<image1>', '<image2>'],

	flags: {
		output: {
			type: String,
			alias: 'o',
			placeholder: '<path>',
			description: 'Output PNG path (default: derived from the input names, beside the first image)',
		},
		crop: {
			type: parseCrop,
			placeholder: '[0-1]',
			description: 'Trim transparent edges automatically. A value uses an alpha threshold when finding the bounds',
		},
		background1: {
			type: parseColor,
			placeholder: '<color>',
			description: 'Background color of image1 as hex (#rrggbb) or "r,g,b" (default: auto-detect from corners)',
		},
		background2: {
			type: parseColor,
			placeholder: '<color>',
			description: 'Background color of image2 as hex (#rrggbb) or "r,g,b" (default: auto-detect from corners)',
		},
		threshold: {
			type: Integer,
			default: 10,
			placeholder: '<0-255>',
			description: 'Minimum per-channel background difference for a channel to inform the alpha estimate',
		},
		floor: {
			type: Float,
			default: 0,
			placeholder: '<0-1>',
			description: 'Snap alpha at or below this to fully transparent. Suppresses background noise (default: off)',
		},
		ceiling: {
			type: Float,
			default: 1,
			placeholder: '<0-1>',
			description: 'Snap alpha at or above this to fully opaque. Suppresses haze (default: off)',
		},
	},

	help: {
		description: 'Strip a solid background to transparency using difference matting between two pixel-aligned PNG, JPEG, or WebP images of the same subject on different background colors. Both inputs recover alpha and foreground color; output is PNG.',
		examples: [
			'unbg bg-white.png bg-black.png',
			'unbg bg-white.jpeg bg-black.jpeg',
			'unbg bg-white.jpeg bg-black.jpeg --crop=0.02',
			'unbg a.png b.png --output logo.png',
			'unbg a.png b.png --background1 "#fff" --background2 0,0,0',
		],
	},
});

const { image1, image2 } = argv._;
const {
	output,
	background1,
	background2,
	threshold,
	floor,
	ceiling,
	crop,
} = argv.flags;

try {
	const [input1, input2] = await Promise.all([
		readFile(image1),
		readFile(image2),
	]);
	const result = await unbg(input1, input2, {
		background1,
		background2,
		channelThreshold: threshold,
		floor,
		ceiling,
		crop,
	});

	console.error(`Background 1: ${formatRgb(result.background1)}`);
	console.error(`Background 2: ${formatRgb(result.background2)}`);
	console.error(`Background distance: ${result.backgroundDistance.toFixed(1)}`);

	if (result.backgroundDistance < 50) {
		console.error('Warning: backgrounds are very similar. Extraction will be noisy. Use more distinct colors (black and white are ideal).');
	}

	if (crop === true) {
		console.error('Crop mode: automatic edge-density');
	} else if (typeof crop === 'number') {
		console.error(`Crop threshold: ${crop.toFixed(3)}`);
		if (result.cropClippingThreshold !== null) {
			console.error(`Starts clipping non-transparent pixels at: ${result.cropClippingThreshold.toFixed(3)}`);
			if (crop >= result.cropClippingThreshold) {
				console.error('Warning: crop threshold clips non-transparent edge pixels');
			}
		}
	}

	const outputPath = output ?? uniqueOutputPath(deriveOutputPath(image1, image2));

	await writeFile(outputPath, result.image);

	console.error(`Saved ${result.width}×${result.height} image to ${path.resolve(outputPath)} (${formatBytes(result.image.length)})`);
} catch (error) {
	console.error(`Error: ${error instanceof Error ? error.message : error}`);
	process.exit(1);
}
