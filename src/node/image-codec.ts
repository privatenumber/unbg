import { readFile } from 'node:fs/promises';
import decodeJpeg, { init as initJpeg } from '@jsquash/jpeg/decode.js';
import decodePng, { init as initPngDecoder } from '@jsquash/png/decode.js';
import encodePng, { init as initPngEncoder } from '@jsquash/png/encode.js';
import decodeWebp, { init as initWebp } from '@jsquash/webp/decode.js';
import type { RgbaImage } from '../core/index.ts';

export type ImageFormat = 'jpeg' | 'png' | 'webp';

let jpegReady: Promise<void> | undefined;
let pngWasm: Promise<Buffer> | undefined;
let pngDecoderReady: Promise<void> | undefined;
let pngEncoderReady: Promise<void> | undefined;
let webpReady: Promise<void> | undefined;

const toExactArrayBuffer = (input: Uint8Array): ArrayBuffer => {
	if (
		input.buffer instanceof ArrayBuffer
		&& input.byteOffset === 0
		&& input.byteLength === input.buffer.byteLength
	) {
		return input.buffer;
	}

	// jSquash decoders accept only ArrayBuffer and ignore typed-array offsets.
	return new Uint8Array(input).buffer as ArrayBuffer;
};

const isPng = (input: Uint8Array) => input.length >= 8
	&& input[0] === 0x89
	&& input[1] === 0x50
	&& input[2] === 0x4E
	&& input[3] === 0x47
	&& input[4] === 0x0D
	&& input[5] === 0x0A
	&& input[6] === 0x1A
	&& input[7] === 0x0A;

const isJpeg = (input: Uint8Array) => input.length >= 3
	&& input[0] === 0xFF
	&& input[1] === 0xD8
	&& input[2] === 0xFF;

const isWebp = (input: Uint8Array) => input.length >= 12
	&& input[0] === 0x52
	&& input[1] === 0x49
	&& input[2] === 0x46
	&& input[3] === 0x46
	&& input[8] === 0x57
	&& input[9] === 0x45
	&& input[10] === 0x42
	&& input[11] === 0x50;

const isAnimatedWebp = (input: Uint8Array) => {
	const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
	for (let offset = 12; offset + 8 <= input.length;) {
		if (
			input[offset] === 0x41
			&& input[offset + 1] === 0x4E
			&& (
				(input[offset + 2] === 0x49 && input[offset + 3] === 0x4D)
				|| (input[offset + 2] === 0x4D && input[offset + 3] === 0x46)
			)
		) {
			return true;
		}

		const length = view.getUint32(offset + 4, true);
		offset += 8 + length + (length % 2);
	}

	return false;
};

const detectFormat = (input: Uint8Array): ImageFormat => {
	if (isPng(input)) {
		return 'png';
	}

	if (isJpeg(input)) {
		return 'jpeg';
	}

	if (isWebp(input)) {
		if (isAnimatedWebp(input)) {
			throw new Error('Animated WebP images are not supported');
		}

		return 'webp';
	}

	throw new Error('Unsupported image format: expected PNG, JPEG, or WebP');
};

const initializeJpeg = () => {
	if (!jpegReady) {
		jpegReady = (async () => {
			const wasm = await readFile(new URL(import.meta.resolve('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm')));
			await initJpeg(await WebAssembly.compile(wasm));
		})();
	}

	return jpegReady;
};

const initializePng = () => {
	if (!pngWasm) {
		pngWasm = readFile(new URL(import.meta.resolve('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')));
	}

	return pngWasm;
};

const initializePngDecoder = () => {
	if (!pngDecoderReady) {
		pngDecoderReady = (async () => {
			await initPngDecoder(await initializePng());
		})();
	}

	return pngDecoderReady;
};

const initializePngEncoder = () => {
	if (!pngEncoderReady) {
		pngEncoderReady = (async () => {
			await initPngEncoder(await initializePng());
		})();
	}

	return pngEncoderReady;
};

const initializeWebp = () => {
	if (!webpReady) {
		webpReady = (async () => {
			const wasm = await readFile(new URL(import.meta.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')));
			await initWebp(await WebAssembly.compile(wasm));
		})();
	}

	return webpReady;
};

const toRgbaImage = ({ data, width, height }: ImageData): RgbaImage => ({
	data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
	width,
	height,
});

const decode = async (input: Uint8Array, format: ImageFormat): Promise<RgbaImage> => {
	const bytes = toExactArrayBuffer(input);
	try {
		switch (format) {
			case 'jpeg': {
				await initializeJpeg();
				return toRgbaImage(await decodeJpeg(bytes));
			}
			case 'png': {
				await initializePngDecoder();
				return toRgbaImage(await decodePng(bytes));
			}
			case 'webp': {
				await initializeWebp();
				return toRgbaImage(await decodeWebp(bytes));
			}
			default: {
				throw new Error(`Unsupported image format: ${format}`);
			}
		}
	} catch {
		throw new Error(`Could not decode ${format.toUpperCase()} image`);
	}
};

export const decodeImage = async (input: Uint8Array): Promise<RgbaImage> => {
	if (!(input instanceof Uint8Array)) {
		throw new TypeError('Expected image bytes as a Buffer or Uint8Array');
	}

	return decode(input, detectFormat(input));
};

export const encodeImage = async ({ data, width, height }: RgbaImage): Promise<Uint8Array> => {
	await initializePngEncoder();
	const hasExactBuffer = data.buffer instanceof ArrayBuffer
		&& data.byteOffset === 0
		&& data.byteLength === data.buffer.byteLength;
	const image = new ImageData(
		// jSquash reads `data.buffer` and ignores byte offsets, so subarrays need a copy.
		hasExactBuffer
			? new Uint8ClampedArray(data.buffer)
			: new Uint8ClampedArray(data),
		width,
		height,
	);
	return new Uint8Array(await encodePng(image));
};
