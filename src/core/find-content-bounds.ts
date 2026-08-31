import type { RgbaImage } from './types.ts';
import { validateRgbaImage } from './validate.ts';

export type ContentBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const minimumForegroundDensity = 0.01;

type EdgeCounts = {
	top: number;
	bottom: number;
	left: number;
	right: number;
};

type TrimEdges = {
	top: boolean;
	bottom: boolean;
	left: boolean;
	right: boolean;
};

type EdgeBounds = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

const alphaAt = (
	data: Uint8Array,
	width: number,
	x: number,
	y: number,
) => data[((y * width) + x) * 4 + 3];

const isSparse = (
	foregroundPixels: number,
	edgeLength: number,
) => foregroundPixels === 0 || foregroundPixels / edgeLength < minimumForegroundDensity;

const createEdgeCounts = (image: RgbaImage) => {
	const rowCounts = new Uint32Array(image.height);
	const columnCounts = new Uint32Array(image.width);
	let foregroundPixels = 0;
	for (let y = 0; y < image.height; y += 1) {
		for (let x = 0; x < image.width; x += 1) {
			if (alphaAt(image.data, image.width, x, y) > 0) {
				rowCounts[y] += 1;
				columnCounts[x] += 1;
				foregroundPixels += 1;
			}
		}
	}

	return {
		rowCounts,
		columnCounts,
		foregroundPixels,
	};
};

const setEdgeCounts = (
	bounds: EdgeBounds,
	rowCounts: Uint32Array,
	columnCounts: Uint32Array,
	edgeCounts: EdgeCounts,
) => {
	edgeCounts.top = rowCounts[bounds.top];
	edgeCounts.bottom = rowCounts[bounds.bottom];
	edgeCounts.left = columnCounts[bounds.left];
	edgeCounts.right = columnCounts[bounds.right];
};

const decrementColumnCounts = (
	image: RgbaImage,
	bounds: EdgeBounds,
	columnCounts: Uint32Array,
	y: number,
) => {
	const { data, width } = image;
	for (let x = bounds.left; x <= bounds.right; x += 1) {
		if (alphaAt(data, width, x, y) > 0) {
			columnCounts[x] -= 1;
		}
	}
};

const decrementRowCounts = (
	image: RgbaImage,
	bounds: EdgeBounds,
	rowCounts: Uint32Array,
	x: number,
) => {
	const { data, width } = image;
	for (let y = bounds.top; y <= bounds.bottom; y += 1) {
		if (alphaAt(data, width, x, y) > 0) {
			rowCounts[y] -= 1;
		}
	}
};

const updateEdgeCounts = (
	image: RgbaImage,
	bounds: EdgeBounds,
	trimEdges: TrimEdges,
	rowCounts: Uint32Array,
	columnCounts: Uint32Array,
) => {
	if (trimEdges.top) {
		decrementColumnCounts(image, bounds, columnCounts, bounds.top);
	}
	if (trimEdges.bottom) {
		decrementColumnCounts(image, bounds, columnCounts, bounds.bottom);
	}
	if (trimEdges.left) {
		decrementRowCounts(image, bounds, rowCounts, bounds.left);
	}
	if (trimEdges.right) {
		decrementRowCounts(image, bounds, rowCounts, bounds.right);
	}
};

const normalizeVerticalTrimEdges = (
	trimEdges: TrimEdges,
	edgeCounts: EdgeCounts,
	currentHeight: number,
) => {
	if (currentHeight === 1) {
		trimEdges.top = false;
		trimEdges.bottom = false;
	} else if (currentHeight === 2 && trimEdges.top && trimEdges.bottom) {
		if (edgeCounts.top <= edgeCounts.bottom) {
			trimEdges.bottom = false;
		} else {
			trimEdges.top = false;
		}
	}
};

const normalizeHorizontalTrimEdges = (
	trimEdges: TrimEdges,
	edgeCounts: EdgeCounts,
	currentWidth: number,
) => {
	if (currentWidth === 1) {
		trimEdges.left = false;
		trimEdges.right = false;
	} else if (currentWidth === 2 && trimEdges.left && trimEdges.right) {
		if (edgeCounts.left <= edgeCounts.right) {
			trimEdges.right = false;
		} else {
			trimEdges.left = false;
		}
	}
};

const normalizeTrimEdges = (
	trimEdges: TrimEdges,
	edgeCounts: EdgeCounts,
	currentWidth: number,
	currentHeight: number,
) => {
	normalizeVerticalTrimEdges(trimEdges, edgeCounts, currentHeight);
	normalizeHorizontalTrimEdges(trimEdges, edgeCounts, currentWidth);
};

const countCornerOverlap = (firstEdge: boolean, secondEdge: boolean, alpha: number) => (
	Number(firstEdge) * Number(secondEdge) * Number(alpha > 0)
);

const countRemovedForeground = (
	image: RgbaImage,
	bounds: EdgeBounds,
	edgeCounts: EdgeCounts,
	trimEdges: TrimEdges,
) => {
	const { data, width } = image;
	let removedForeground = 0;
	if (trimEdges.top) {
		removedForeground += edgeCounts.top;
	}
	if (trimEdges.bottom) {
		removedForeground += edgeCounts.bottom;
	}
	if (trimEdges.left) {
		removedForeground += edgeCounts.left;
	}
	if (trimEdges.right) {
		removedForeground += edgeCounts.right;
	}
	removedForeground -= countCornerOverlap(
		trimEdges.top,
		trimEdges.left,
		alphaAt(data, width, bounds.left, bounds.top),
	);
	removedForeground -= countCornerOverlap(
		trimEdges.top,
		trimEdges.right,
		alphaAt(data, width, bounds.right, bounds.top),
	);
	removedForeground -= countCornerOverlap(
		trimEdges.bottom,
		trimEdges.left,
		alphaAt(data, width, bounds.left, bounds.bottom),
	);
	removedForeground -= countCornerOverlap(
		trimEdges.bottom,
		trimEdges.right,
		alphaAt(data, width, bounds.right, bounds.bottom),
	);
	return removedForeground;
};

const keepOnlyEmptyEdges = (trimEdges: TrimEdges, edgeCounts: EdgeCounts) => {
	if (trimEdges.top) {
		trimEdges.top = edgeCounts.top === 0;
	}
	if (trimEdges.bottom) {
		trimEdges.bottom = edgeCounts.bottom === 0;
	}
	if (trimEdges.left) {
		trimEdges.left = edgeCounts.left === 0;
	}
	if (trimEdges.right) {
		trimEdges.right = edgeCounts.right === 0;
	}
};

const hasTrimEdges = (trimEdges: TrimEdges) => (
	trimEdges.top || trimEdges.bottom || trimEdges.left || trimEdges.right
);

const advanceBounds = (bounds: EdgeBounds, trimEdges: TrimEdges) => {
	const nextLeft = bounds.left + (trimEdges.left ? 1 : 0);
	const nextTop = bounds.top + (trimEdges.top ? 1 : 0);
	const nextRight = bounds.right - (trimEdges.right ? 1 : 0);
	const nextBottom = bounds.bottom - (trimEdges.bottom ? 1 : 0);
	if (nextLeft > nextRight || nextTop > nextBottom) {
		return false;
	}

	bounds.left = nextLeft;
	bounds.top = nextTop;
	bounds.right = nextRight;
	bounds.bottom = nextBottom;
	return true;
};

/**
 * Finds the content bounds of a matte by trimming sparse outer rows and columns.
 *
 * The detector treats every pixel with alpha greater than zero as foreground,
 * counts foreground pixels on each current edge, and removes an edge when fewer
 * than 1% of that edge contains foreground. It repeats this from the outside in
 * so a single isolated pixel cannot keep a large transparent canvas in place,
 * while a soft edge that spans a meaningful part of a row or column is retained.
 * All eligible edges are evaluated before any edge is removed. This makes the
 * result independent of whether the image is scanned from the top, bottom, left,
 * or right first.
 *
 * The edge-trimming shape is an occupancy-based extension of ImageMagick's
 * `TrimImage` operation:
 * https://github.com/ImageMagick/ImageMagick/blob/7.0.8-31/MagickCore/transform.c#L2376-L2430
 * This function only finds bounds. Callers apply them to the original matte so
 * the detection step never changes retained pixel values.
 */
export const findContentBounds = (image: RgbaImage): ContentBounds | null => {
	validateRgbaImage(image, 'image');

	const { width, height } = image;
	const {
		rowCounts, columnCounts, foregroundPixels: initialForegroundPixels,
	} = createEdgeCounts(image);
	let foregroundPixels = initialForegroundPixels;

	if (foregroundPixels === 0) {
		return null;
	}

	const bounds: EdgeBounds = {
		left: 0,
		top: 0,
		right: width - 1,
		bottom: height - 1,
	};
	const edgeCounts: EdgeCounts = {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0,
	};
	const trimEdges: TrimEdges = {
		top: false,
		bottom: false,
		left: false,
		right: false,
	};

	while (bounds.left <= bounds.right && bounds.top <= bounds.bottom) {
		const currentWidth = bounds.right - bounds.left + 1;
		const currentHeight = bounds.bottom - bounds.top + 1;
		setEdgeCounts(bounds, rowCounts, columnCounts, edgeCounts);
		trimEdges.top = isSparse(edgeCounts.top, currentWidth);
		trimEdges.bottom = isSparse(edgeCounts.bottom, currentWidth);
		trimEdges.left = isSparse(edgeCounts.left, currentHeight);
		trimEdges.right = isSparse(edgeCounts.right, currentHeight);
		normalizeTrimEdges(trimEdges, edgeCounts, currentWidth, currentHeight);

		if (!hasTrimEdges(trimEdges)) {
			break;
		}

		let removedForeground = countRemovedForeground(
			image,
			bounds,
			edgeCounts,
			trimEdges,
		);

		// Keep an edge containing the last foreground pixels. Empty eligible edges
		// can still be removed, allowing the remaining content to become dense.
		if (removedForeground >= foregroundPixels) {
			keepOnlyEmptyEdges(trimEdges, edgeCounts);
			normalizeTrimEdges(trimEdges, edgeCounts, currentWidth, currentHeight);
			removedForeground = 0;
		}

		if (!hasTrimEdges(trimEdges)) {
			break;
		}

		updateEdgeCounts(image, bounds, trimEdges, rowCounts, columnCounts);
		if (!advanceBounds(bounds, trimEdges)) {
			break;
		}

		foregroundPixels -= removedForeground;
	}

	return {
		x: bounds.left,
		y: bounds.top,
		width: bounds.right - bounds.left + 1,
		height: bounds.bottom - bounds.top + 1,
	};
};
