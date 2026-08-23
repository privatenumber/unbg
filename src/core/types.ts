export type Rgb = {
	r: number;
	g: number;
	b: number;
};

/**
 * Raw, unpremultiplied 8-bit RGBA pixels: 4 bytes per pixel, row-major. This is
 * the unit of currency for the core — every function takes and returns one, so
 * "valid pixel data" is enforced by the type and the shared validator rather
 * than re-derived from loose `data`/`width`/`height` arguments at each call.
 */
export type RgbaImage = {

	/** Pixel buffer of exactly `width * height * 4` bytes. */
	data: Uint8Array;

	width: number;

	height: number;
};

export type DifferenceMattingOptions = {

	/**
	 * Background color of the first image.
	 * Auto-detected from the corner pixels when omitted.
	 */
	background1?: Rgb;

	/**
	 * Background color of the second image.
	 * Auto-detected from the corner pixels when omitted.
	 */
	background2?: Rgb;

	/**
	 * Minimum per-channel background difference (0-255) for a channel to
	 * contribute to the alpha estimate. Channels whose backgrounds barely
	 * differ carry mostly noise, so they're skipped.
	 *
	 * @default 10
	 */
	channelThreshold?: number;

	/**
	 * Alpha values (0-1) at or below this snap to fully transparent, to
	 * suppress faint background noise. Aggressive values erode genuinely soft
	 * detail (smoke, glow), so it's off by default.
	 *
	 * @default 0
	 */
	floor?: number;

	/**
	 * Alpha values (0-1) at or above this snap to fully opaque, to suppress
	 * haze over solid areas.
	 *
	 * @default 1
	 */
	ceiling?: number;

};
