import { detectBackground } from './detect-background.ts';
import { validateRgbaImage } from './validate.ts';
import type { Rgb, RgbaImage, DifferenceMattingOptions } from './types.ts';

export type DifferenceMattingResult = RgbaImage & {

	/** Background color used for the first image. */
	background1: Rgb;

	/** Background color used for the second image. */
	background2: Rgb;

	/** Euclidean distance between the two background colors (0-441.7). */
	backgroundDistance: number;
};

const clamp = (
	value: number,
	minimum: number,
	maximum: number,
) => Math.max(minimum, Math.min(maximum, value));

const validateRange = (value: number, name: string, minimum: number, maximum: number) => {
	if (!Number.isFinite(value) || value < minimum || value > maximum) {
		throw new RangeError(`${name} must be a finite number between ${minimum} and ${maximum}`);
	}

	return value;
};

const validateRgb = (color: Rgb, name: string) => {
	validateRange(color.r, `${name}.r`, 0, 255);
	validateRange(color.g, `${name}.g`, 0, 255);
	validateRange(color.b, `${name}.b`, 0, 255);
};

const colorDistance = (
	a: Rgb,
	b: Rgb,
) => Math.hypot(
	(a.r - b.r),
	(a.g - b.g),
	(a.b - b.b),
);

type ResolvedOptions = {
	background1?: Rgb;
	background2?: Rgb;
	channelThreshold: number;
	floor: number;
	ceiling: number;
};

/**
 * Fills in defaults and validates every option, so the algorithm below can
 * trust each value without re-checking it.
 */
export const validateDifferenceMattingOptions = (
	options: DifferenceMattingOptions | undefined,
): ResolvedOptions => {
	if (options?.background1) {
		validateRgb(options.background1, 'background1');
	}
	if (options?.background2) {
		validateRgb(options.background2, 'background2');
	}
	const channelThreshold = validateRange(options?.channelThreshold ?? 10, 'channelThreshold', 0, 255);
	const floor = validateRange(options?.floor ?? 0, 'floor', 0, 1);
	const ceiling = validateRange(options?.ceiling ?? 1, 'ceiling', 0, 1);
	if (floor > ceiling) {
		throw new RangeError('floor must not exceed ceiling');
	}

	return {
		background1: options?.background1,
		background2: options?.background2,
		channelThreshold,
		floor,
		ceiling,
	};
};

/**
 * Solves the compositing equation for one foreground channel:
 * `C = (observed - (1 - alpha)*B) / alpha`. The caller passes `1/alpha` so the
 * per-pixel loop divides once and multiplies three times instead of dividing three times.
 */
const recoverChannel = (
	blendedObserved: number,
	blendedBackground: number,
	inverseAlpha: number,
	alphaReciprocal: number,
) => (blendedObserved - inverseAlpha * blendedBackground) * alphaReciprocal;

type Channel = {
	index: number;
	delta: number;
	weight: number;
};

type AlphaChannel = {
	index: number;
	invDelta: number;
	factor: number;
};

const validateImagePair = (image1: RgbaImage, image2: RgbaImage) => {
	validateRgbaImage(image1, 'image1');
	validateRgbaImage(image2, 'image2');
	if (image1.width !== image2.width || image1.height !== image2.height) {
		throw new Error(
			`Both images must have the same dimensions (image1 is ${image1.width}×${image1.height}, image2 is ${image2.width}×${image2.height})`,
		);
	}
};

type MattingInput = {
	data1: Uint8Array;
	data2: Uint8Array;
	alphaChannels: AlphaChannel[];
	floor: number;
	ceiling: number;
	blendedBackground: Rgb;
};

const matte = (input: MattingInput) => {
	const data = new Uint8Array(input.data1.length);

	for (let offset = 0; offset < input.data1.length; offset += 4) {
		if (input.data1[offset + 3] !== 255) {
			throw new Error('image1 must be fully opaque');
		}
		if (input.data2[offset + 3] !== 255) {
			throw new Error('image2 must be fully opaque');
		}

		let alpha = 1;
		if (input.alphaChannels.length > 0) {
			let alphaSum = 0;
			for (const channel of input.alphaChannels) {
				const difference = input.data1[offset + channel.index]
					- input.data2[offset + channel.index];
				alphaSum += (1 - difference * channel.invDelta) * channel.factor;
			}

			alpha = clamp(alphaSum, 0, 1);
		}

		if (alpha <= input.floor) {
			alpha = 0;
		} else if (alpha >= input.ceiling) {
			alpha = 1;
		}
		const inverseAlpha = 1 - alpha;
		let r = 0;
		let g = 0;
		let b = 0;
		if (alpha > 0.01) {
			const alphaReciprocal = 1 / alpha;
			r = recoverChannel(
				(input.data1[offset] + input.data2[offset]) * 0.5,
				input.blendedBackground.r,
				inverseAlpha,
				alphaReciprocal,
			);
			g = recoverChannel(
				(input.data1[offset + 1] + input.data2[offset + 1]) * 0.5,
				input.blendedBackground.g,
				inverseAlpha,
				alphaReciprocal,
			);
			b = recoverChannel(
				(input.data1[offset + 2] + input.data2[offset + 2]) * 0.5,
				input.blendedBackground.b,
				inverseAlpha,
				alphaReciprocal,
			);
		}

		data[offset] = clamp(Math.round(r), 0, 255);
		data[offset + 1] = clamp(Math.round(g), 0, 255);
		data[offset + 2] = clamp(Math.round(b), 0, 255);
		data[offset + 3] = Math.round(alpha * 255);
	}

	return data;
};

/**
 * Recovers a transparent foreground from two raw RGBA images of the same
 * subject, each shot against a different solid background color.
 *
 * Difference matting solves the compositing equation `obs = alpha*C + (1-alpha)*B`.
 * The same pixel observed over two known backgrounds gives two equations,
 * which solve for both the alpha and the unmixed foreground color:
 *
 *   alpha = 1 - (obs1 - obs2) / (B1 - B2)
 *   C = (obs - (1-alpha)*B) / alpha
 *
 * Both images must be pixel-aligned and the same dimensions.
 */
export const differenceMatting = (
	image1: RgbaImage,
	image2: RgbaImage,
	options?: DifferenceMattingOptions,
): DifferenceMattingResult => {
	validateImagePair(image1, image2);
	const resolvedOptions = validateDifferenceMattingOptions(options);

	const { data: data1, width, height } = image1;
	const { data: data2 } = image2;
	const background1 = resolvedOptions.background1 ?? detectBackground(image1);
	const background2 = resolvedOptions.background2 ?? detectBackground(image2);
	const {
		channelThreshold,
		floor,
		ceiling,
	} = resolvedOptions;

	// The background separation is constant across the whole image, so the
	// channels that inform the alpha estimate are computed once. Channels that
	// separate the two backgrounds the most carry the strongest signal; ones
	// below the noise threshold (or with no separation at all) are skipped.
	const backgroundDifferences: [number, number, number] = [
		background1.r - background2.r,
		background1.g - background2.g,
		background1.b - background2.b,
	];
	const channels: Channel[] = backgroundDifferences
		.map((delta, index) => ({
			index,
			delta,
			weight: Math.abs(delta),
		}))
		.filter(channel => channel.weight >= channelThreshold && channel.weight > 0);
	if (channels.length === 0) {
		throw new Error('No usable background channels: use more distinct backgrounds or lower channelThreshold');
	}

	const totalWeight = channels.reduce((sum, channel) => sum + channel.weight, 0);
	// Precompute reciprocals so the per-pixel loop multiplies instead of divides:
	// `invDelta` turns each channel's `/delta` into a multiply, and `factor` folds
	// in the `/totalWeight` normalization (the factors sum to 1).
	const alphaChannels = channels.map(({ index, delta, weight }) => ({
		index,
		invDelta: 1 / delta,
		factor: weight / totalWeight,
	}));
	// Both source estimates contribute equally to color recovery. The blended
	// background is constant per channel, so each pixel solves one equation.
	const blendedBackground = {
		r: (background1.r + background2.r) * 0.5,
		g: (background1.g + background2.g) * 0.5,
		b: (background1.b + background2.b) * 0.5,
	};
	const data = matte({
		data1,
		data2,
		alphaChannels,
		floor,
		ceiling,
		blendedBackground,
	});

	return {
		data,
		width,
		height,
		background1,
		background2,
		backgroundDistance: colorDistance(background1, background2),
	};
};
