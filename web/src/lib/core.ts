/**
 * Re-exports the dependency-free unbg core directly from source.
 *
 * The web app and its tests consume the algorithm from `../../../src/core`
 * rather than the published `unbg/core` entry, so they build and run without a
 * prior `pnpm build` of the library. This module is the single place that knows
 * the path to the sibling source.
 */
export * from '../../../src/core/index.ts';
export {
	cropImage, findCropBounds,
} from '../../../src/core/crop-transparent.ts';
export {
	findContentBounds,
	type ContentBounds,
} from '../../../src/core/find-content-bounds.ts';
