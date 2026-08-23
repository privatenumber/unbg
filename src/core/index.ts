/**
 * Isomorphic core: the pure difference-matting algorithm with no Node.js
 * dependencies (no `node:fs`, no image codec, no `Buffer`). Safe to bundle for the
 * browser, Web Workers, Deno, and edge runtimes.
 *
 * Difference matting operates on opaque raw RGBA pixel buffers (`Uint8Array`),
 * so the host is responsible for decoding and encoding images. In Node, prefer
 * the `unbg` entry point, which accepts PNG, JPEG, and WebP input and returns PNG output.
 */

export type { Rgb, RgbaImage, DifferenceMattingOptions } from './types.ts';
export type { DifferenceMattingResult } from './difference-matting.ts';
export { differenceMatting } from './difference-matting.ts';
export { detectBackground } from './detect-background.ts';
export { cropTransparent } from './crop-transparent.ts';
