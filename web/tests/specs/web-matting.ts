import { effectScope } from 'vue';
import { describe, test, expect } from 'manten';
import { createMattingStore, type MattingIo } from '../../src/composables/use-matting.ts';
import type { RgbaImage } from '../../src/lib/core.ts';
import type { DecodedImage } from '../../src/lib/image-codec.ts';
import type { MattingProcessor } from '../../src/lib/matting-processor.ts';
import type { ImageSlot, MattingOutput } from '../../src/lib/matting-protocol.ts';

const solidImage = (r: number, g: number, b: number): RgbaImage => ({
	data: new Uint8Array([r, g, b, 255]),
	width: 1,
	height: 1,
});

const pngFile = (name: string) => new File(['fake'], name, { type: 'image/png' });

const decodedImage = (image: RgbaImage): DecodedImage => ({
	image,
	preview: new Blob(['preview'], { type: 'image/png' }),
});

const matteOutput = (): MattingOutput => ({
	image: new Blob(['matte'], { type: 'image/png' }),
	width: 1,
	height: 1,
	background1: {
		r: 255,
		g: 255,
		b: 255,
	},
	background2: {
		r: 0,
		g: 0,
		b: 0,
	},
	backgroundDistance: Math.sqrt(3 * (255 ** 2)),
});

/** Flush macrotasks so a `debounceMs: 0` run can fire and settle. */
const tick = () => new Promise((resolve) => {
	setTimeout(resolve, 0);
});

/**
 * A fully controllable {@link MattingIo}. Decodes and worker outputs resolve through
 * lazily-created deferreds, so tests can choose exactly when each boundary settles.
 */
const createTestIo = () => {
	const decodes = new Map<Blob, PromiseWithResolvers<DecodedImage>>();
	const mattes: PromiseWithResolvers<MattingOutput>[] = [];
	const decodedSources: Blob[] = [];
	const revokedUrls: string[] = [];
	const receivedImages: Partial<Record<ImageSlot, RgbaImage>> = {};
	const receivedCrop: boolean[] = [];
	let urlId = 0;
	let disposed = false;
	let invalidationCount = 0;

	const decodeDeferred = (source: Blob) => {
		let deferred = decodes.get(source);
		if (!deferred) {
			deferred = Promise.withResolvers<DecodedImage>();
			decodes.set(source, deferred);
		}

		return deferred;
	};
	const processor: MattingProcessor = {
		setImage: (slot, image) => {
			receivedImages[slot] = image;
		},
		clearImage: (slot) => {
			receivedImages[slot] = undefined;
		},
		matte: (_options, crop) => {
			receivedCrop.push(crop);
			const deferred = Promise.withResolvers<MattingOutput>();
			mattes.push(deferred);
			return deferred.promise;
		},
		invalidate: () => {
			invalidationCount += 1;
			for (const deferred of mattes) {
				deferred.reject(new Error('Matte request superseded'));
			}
		},
		dispose: () => {
			disposed = true;
		},
	};

	const io: MattingIo = {
		decodeImage: (source) => {
			decodedSources.push(source);
			return decodeDeferred(source).promise;
		},
		createProcessor: () => processor,
		createObjectURL: () => {
			urlId += 1;
			return `blob:mock-${urlId}`;
		},
		revokeObjectURL: (url) => {
			revokedUrls.push(url);
		},
		nextFrame: () => Promise.resolve(),
	};

	return {
		io,
		mattes,
		decodedSources,
		revokedUrls,
		receivedImages,
		receivedCrop,
		isDisposed: () => disposed,
		getInvalidationCount: () => invalidationCount,
		resolveDecode: (source: Blob, image: RgbaImage) => {
			decodeDeferred(source).resolve(decodedImage(image));
		},
	};
};

const createStore = (io: MattingIo) => {
	const scope = effectScope();
	const store = scope.run(() => createMattingStore({
		io,
		debounceMs: 0,
	}));
	if (!store) {
		throw new Error('Expected matting store');
	}

	return {
		store,
		scope,
	};
};

describe('web matting', () => {
	test('crops by default and reruns when crop changes', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);
		try {
			const first = pngFile('white.png');
			const second = pngFile('black.png');
			browser.resolveDecode(first, solidImage(255, 255, 255));
			browser.resolveDecode(second, solidImage(0, 0, 0));

			await store.setImage(1, first);
			await store.setImage(2, second);
			await tick();

			expect(browser.receivedCrop).toStrictEqual([true]);
			store.options.crop = false;
			await tick();

			expect(browser.receivedCrop).toStrictEqual([true, false]);
		} finally {
			scope.stop();
		}
	});

	test('does not let a stale matte result land after an image is cleared', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);
		try {
			const first = pngFile('white.png');
			const second = pngFile('black.png');
			browser.resolveDecode(first, solidImage(255, 255, 255));
			browser.resolveDecode(second, solidImage(0, 0, 0));

			await store.setImage(1, first);
			await store.setImage(2, second);

			// Let the debounced run start and reach the pending worker operation.
			await tick();
			expect(browser.mattes.length).toBe(1);

			store.clearImage(1);
			await tick();

			expect(store.result.value).toBe(null);
		} finally {
			scope.stop();
		}
	});

	test('keeps the newer image when an older decode finishes last', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);
		try {
			const slow = pngFile('slow.png');
			const fast = pngFile('fast.png');

			const slowSet = store.setImage(1, slow);
			const fastSet = store.setImage(1, fast);

			browser.resolveDecode(fast, solidImage(0, 0, 0));
			await fastSet;
			expect(store.image1.value?.name).toBe('fast.png');

			browser.resolveDecode(slow, solidImage(255, 255, 255));
			await slowSet;
			expect(store.image1.value?.name).toBe('fast.png');
		} finally {
			scope.stop();
		}
	});

	test('keeps a manual pick over a slow source claimed before it', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);
		try {
			const exampleSource = Promise.withResolvers<File>();
			const example = pngFile('example.png');
			const manual = pngFile('manual.png');

			// The example claims the slot first but is still fetching; the manual
			// pick claims it next and must win.
			const exampleSet = store.setImage(1, exampleSource.promise);
			const manualSet = store.setImage(1, manual);

			browser.resolveDecode(manual, solidImage(0, 0, 0));
			await manualSet;
			expect(store.image1.value?.name).toBe('manual.png');

			exampleSource.resolve(example);
			browser.resolveDecode(example, solidImage(255, 255, 255));
			await exampleSet;
			expect(store.image1.value?.name).toBe('manual.png');
			expect(browser.decodedSources).not.toContain(example);
		} finally {
			scope.stop();
		}
	});

	test('retires active work when a replacement starts decoding', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);
		try {
			const first = pngFile('white.png');
			const second = pngFile('black.png');
			browser.resolveDecode(first, solidImage(255, 255, 255));
			browser.resolveDecode(second, solidImage(0, 0, 0));
			await store.setImage(1, first);
			await store.setImage(2, second);
			expect(browser.receivedImages[1]?.width).toBe(1);
			expect(browser.receivedImages[2]?.width).toBe(1);
			await tick();
			const invalidationCount = browser.getInvalidationCount();

			const replacement = Promise.withResolvers<File>();
			const replacementFile = pngFile('replacement.png');
			const replacementSet = store.setImage(1, replacement.promise);
			expect(browser.getInvalidationCount()).toBe(invalidationCount + 1);

			replacement.resolve(replacementFile);
			browser.resolveDecode(replacementFile, solidImage(255, 255, 255));
			await replacementSet;
		} finally {
			scope.stop();
		}
	});

	test('ignores a decode that resolves after the scope is disposed', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);

		const late = pngFile('late.png');
		const setPromise = store.setImage(1, late);

		scope.stop();
		browser.resolveDecode(late, solidImage(255, 255, 255));
		await setPromise;

		expect(store.image1.value).toBe(null);
		expect(browser.isDisposed()).toBe(true);
	});

	test('keeps background metadata in the result', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);
		try {
			const first = pngFile('white.png');
			const second = pngFile('black.png');
			browser.resolveDecode(first, solidImage(255, 255, 255));
			browser.resolveDecode(second, solidImage(0, 0, 0));

			await store.setImage(1, first);
			await store.setImage(2, second);
			await tick();
			browser.mattes[0].resolve(matteOutput());
			await tick();

			expect(store.result.value?.backgroundDistance).toBeCloseTo(Math.sqrt(3 * (255 ** 2)), 1);
		} finally {
			scope.stop();
		}
	});

	test('replaces and releases bounded preview URLs', async () => {
		const browser = createTestIo();
		const { store, scope } = createStore(browser.io);
		try {
			const first = pngFile('first.png');
			const replacement = pngFile('replacement.png');
			browser.resolveDecode(first, solidImage(255, 255, 255));
			await store.setImage(1, first);
			const firstUrl = store.image1.value?.previewUrl;

			browser.resolveDecode(replacement, solidImage(0, 0, 0));
			await store.setImage(1, replacement);
			expect(browser.revokedUrls).toContain(firstUrl);
			const replacementUrl = store.image1.value?.previewUrl;
			scope.stop();
			expect(browser.revokedUrls).toContain(replacementUrl);
			expect(browser.isDisposed()).toBe(true);
		} finally {
			scope.stop();
		}
	});
});
