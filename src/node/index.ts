import {
	cropContent, cropTransparent, differenceMatting,
	type Rgb, type DifferenceMattingOptions,
} from '../core/index.ts';
import { validateCropThreshold } from '../core/crop-transparent.ts';
import { validateDifferenceMattingOptions } from '../core/difference-matting.ts';
import { decodeImage, encodeImage } from './image-codec.ts';

export type UnbgResult = {

	/**
	 * PNG-encoded bytes of the extracted foreground.
	 * Persist it however you like. Use `fs.writeFile(path, image)`, an HTTP
	 * response body, or an upload. The library does no file writing of its own.
	 */
	image: Uint8Array;

	width: number;

	height: number;

	/** Background color used for the first image. */
	background1: Rgb;

	/** Background color used for the second image. */
	background2: Rgb;

	/** Euclidean distance between the two background colors (0-441.7). */
	backgroundDistance: number;

	/** First numeric crop threshold that excludes a nontransparent edge pixel. */
	cropClippingThreshold: number | null;

};

export type UnbgOptions = DifferenceMattingOptions & {

	/**
	 * Trim transparent edges from the result. `true` uses automatic edge-density
	 * trimming. A number from 0 to 1 sets the alpha threshold used only to
	 * calculate the crop bounds.
	 */
	crop?: boolean | number;
};

/**
 * Removes a solid background from two PNG, JPEG, or WebP images of the same
 * subject, each shot against a different solid background color, using
 * difference matting.
 *
 * The images must be opaque, pixel-aligned, and the same dimensions. The two
 * background colors should be as distinct as possible; pure black and white are ideal.
 * Set `crop` to trim transparent edges. `true` uses automatic edge-density
 * trimming; a numeric value sets the alpha threshold used only to calculate the
 * crop bounds.
 *
 * @example
 * ```ts
 * import { readFile, writeFile } from 'node:fs/promises';
 *
 * const [onWhite, onBlack] = await Promise.all([
 * 	readFile('on-white.png'),
 * 	readFile('on-black.png'),
 * ]);
 * const { image } = await unbg(onWhite, onBlack);
 * await writeFile('transparent.png', image);
 * ```
 */
export const unbg = async (
	image1: Uint8Array,
	image2: Uint8Array,
	options?: UnbgOptions,
): Promise<UnbgResult> => {
	validateDifferenceMattingOptions(options);
	validateCropThreshold(typeof options?.crop === 'number' ? options.crop : undefined);
	const [first, second] = await Promise.all([
		decodeImage(image1),
		decodeImage(image2),
	]);

	// Dimension and structural validation live in the core (`differenceMatting`),
	// so both the Node and browser entry points enforce the same contract.
	const result = differenceMatting(first, second, options);
	const crop = options?.crop;
	const image = crop === undefined || crop === false
		? result
		: (crop === true ? cropContent(result) : cropTransparent(result, crop));
	const encoded = await encodeImage(image);

	return {
		image: encoded,
		width: image.width,
		height: image.height,
		background1: result.background1,
		background2: result.background2,
		backgroundDistance: result.backgroundDistance,
		cropClippingThreshold: result.cropClippingThreshold,
	};
};
