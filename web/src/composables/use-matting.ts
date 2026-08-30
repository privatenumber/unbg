import {
	computed, inject, onScopeDispose, provide, reactive, ref, shallowRef, watch,
	type InjectionKey,
} from 'vue';
import {
	detectBackground,
	type Rgb, type DifferenceMattingOptions,
} from '../lib/core.ts';
import { decodeImage, type DecodedImage } from '../lib/image-codec.ts';
import { createMattingProcessor, type MattingProcessor } from '../lib/matting-processor.ts';
import type {
	CropMetadata, CropValue, ImageSlot,
} from '../lib/matting-protocol.ts';

export type Slot = ImageSlot;

export type LoadedImage = {
	width: number;
	height: number;
	background: Rgb;
	name: string;
	size: number;
	previewUrl: string;

	/** Whether the source file is lossless. Lossy formats corrupt the matte. */
	isLossless: boolean;
};

export type MattingResult = {
	url: string;
	mattePreviewUrl: string;
	width: number;
	height: number;
	crop: CropValue;
	cropMetadata: CropMetadata;
	background1: Rgb;
	background2: Rgb;
	backgroundDistance: number;
	cropClippingThreshold: number | null;
	size: number;
};

export type Status = 'idle' | 'processing' | 'error';

export type MattingOptions = {
	bg1Auto: boolean;
	bg2Auto: boolean;
	bg1: Rgb;
	bg2: Rgb;
	threshold: number;
	floor: number;
	ceiling: number;
	crop: CropValue;
};

type MatteRequest = {
	first: LoadedImage | null;
	second: LoadedImage | null;
	options: DifferenceMattingOptions;
};

/**
 * The browser IO the store depends on, injected as a unit so the matting logic
 * can be exercised without a DOM (decode, worker processing, object URLs, animation
 * frames). Production uses {@link browserIo}; tests pass controllable stubs.
 */
export type MattingIo = {
	decodeImage: (source: Blob) => Promise<DecodedImage>;
	createProcessor: () => MattingProcessor;
	createObjectURL: (object: Blob) => string;
	revokeObjectURL: (url: string) => void;
	nextFrame: () => Promise<void>;
};

const browserIo = (): MattingIo => ({
	decodeImage,
	createProcessor: createMattingProcessor,
	createObjectURL: object => URL.createObjectURL(object),
	revokeObjectURL: url => URL.revokeObjectURL(url),
	nextFrame: () => new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
	}),
});

/** The single source of truth for option defaults (also used by `reset`). */
const createDefaultOptions = (): MattingOptions => ({
	bg1Auto: true,
	bg2Auto: true,
	bg1: {
		r: 255,
		g: 255,
		b: 255,
	},
	bg2: {
		r: 0,
		g: 0,
		b: 0,
	},
	threshold: 10,
	floor: 0,
	ceiling: 1,
	crop: true,
});

/**
 * A monotonic token for "latest wins" async coordination. `claim()` starts a new
 * generation and returns a predicate reporting whether it's still current; any
 * later `claim()` or `invalidate()` retires every earlier predicate. This is the
 * one primitive that keeps stale decodes and stale matte results from landing.
 */
const createGeneration = () => {
	let current = 0;

	return {
		claim: () => {
			current += 1;
			const claimed = current;
			return () => claimed === current;
		},
		invalidate: () => {
			current += 1;
		},
	};
};

export type CreateMattingStoreOptions = {
	io?: MattingIo;

	/** Debounce (ms) between an input/option change and re-running the matte. */
	debounceMs?: number;
};

export const createMattingStore = ({
	io = browserIo(),
	debounceMs = 120,
}: CreateMattingStoreOptions = {}) => {
	// Images and the result hold immutable objects with large binary payloads,
	// and are only ever replaced wholesale. `shallowRef` skips deep proxying.
	const image1 = shallowRef<LoadedImage | null>(null);
	const image2 = shallowRef<LoadedImage | null>(null);
	const options = reactive(createDefaultOptions());

	const result = shallowRef<MattingResult | null>(null);
	const cropPreviewValue = ref<CropValue>(options.crop);
	const cropPreviewActive = ref(false);
	const status = ref<Status>('idle');
	const error = ref<string | null>(null);

	// The output area only appears once there's something to show, never as an
	// empty panel on landing.
	const showOutput = computed(() => (
		Boolean(result.value) || status.value === 'processing' || status.value === 'error'
	));

	const revokePreview = (image: LoadedImage | null) => {
		if (image) {
			io.revokeObjectURL(image.previewUrl);
		}
	};

	/** Background colors auto-detected from each image's corners (for UI hints). */
	const detected1 = computed(() => image1.value?.background ?? null);
	const detected2 = computed(() => image2.value?.background ?? null);
	const cropClippingThreshold = computed(() => result.value?.cropClippingThreshold ?? null);

	const releaseResult = () => {
		if (result.value) {
			io.revokeObjectURL(result.value.url);
			io.revokeObjectURL(result.value.mattePreviewUrl);
			result.value = null;
		}
	};

	// The complete input boundary for a matte. Everything downstream, including
	// crop metadata and the cropped PNG, belongs to this exact snapshot.
	const matteRequest = computed<MatteRequest>(() => ({
		first: image1.value,
		second: image2.value,
		options: {
			background1: options.bg1Auto ? undefined : { ...options.bg1 },
			background2: options.bg2Auto ? undefined : { ...options.bg2 },
			channelThreshold: options.threshold,
			floor: options.floor,
			ceiling: options.ceiling,
		},
	}));

	const sizeMismatch = (first: LoadedImage, second: LoadedImage): string | null => {
		if (first.width === second.width && first.height === second.height) {
			return null;
		}

		return `Both images must be the same size (got ${first.width}×${first.height} and ${second.width}×${second.height}).`;
	};

	// "Latest wins" guards: the active matte run, and each slot's in-flight decode.
	const processing = createGeneration();
	const cropProcessing = createGeneration();
	const processor = io.createProcessor();
	const decoding: Record<Slot, ReturnType<typeof createGeneration>> = {
		1: createGeneration(),
		2: createGeneration(),
	};
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let matteSchedulePending = false;
	let mattePendingCount = 0;

	const produceCrop = async (crop: CropValue, isCurrent: () => boolean) => {
		try {
			const cropped = await processor.crop(crop);
			if (!isCurrent()) {
				return;
			}

			const current = result.value;
			if (!current) {
				return;
			}

			const url = io.createObjectURL(cropped.image);
			io.revokeObjectURL(current.url);
			result.value = {
				...current,
				url,
				width: cropped.width,
				height: cropped.height,
				crop: cropped.crop,
				size: cropped.image.size,
			};
			status.value = 'idle';
		} catch (error_) {
			if (!isCurrent()) {
				return;
			}

			status.value = 'error';
			error.value = error_ instanceof Error ? error_.message : String(error_);
		}
	};

	const requestCrop = (crop: CropValue) => {
		const current = result.value;
		if (
			!current
			|| matteSchedulePending
			|| mattePendingCount > 0
			|| current.crop === crop
		) {
			return;
		}

		const isCurrent = cropProcessing.claim();
		processor.invalidateCrop();
		status.value = 'processing';
		produceCrop(crop, isCurrent).catch((error_) => {
			if (isCurrent()) {
				status.value = 'error';
				error.value = error_ instanceof Error ? error_.message : String(error_);
			}
		});
	};

	const produceMatte = async (request: MatteRequest, isCurrent: () => boolean) => {
		try {
			const matte = await processor.matte(
				request.options,
				options.crop,
			);
			if (!isCurrent()) {
				return;
			}

			releaseResult();
			result.value = {
				url: io.createObjectURL(matte.image),
				mattePreviewUrl: io.createObjectURL(matte.mattePreview),
				width: matte.width,
				height: matte.height,
				crop: matte.crop,
				cropMetadata: matte.cropMetadata,
				background1: matte.background1,
				background2: matte.background2,
				backgroundDistance: matte.backgroundDistance,
				cropClippingThreshold: matte.cropClippingThreshold,
				size: matte.image.size,
			};
			status.value = 'idle';
		} catch (error_) {
			if (!isCurrent()) {
				return;
			}

			releaseResult();
			status.value = 'error';
			error.value = error_ instanceof Error ? error_.message : String(error_);
		}
	};

	const startCropPreview = (crop: CropValue) => {
		cropPreviewValue.value = crop;
		cropPreviewActive.value = true;
	};

	const updateCropPreview = (crop: CropValue) => {
		cropPreviewValue.value = crop;
		cropPreviewActive.value = true;
	};

	const endCropPreview = () => {
		cropPreviewValue.value = options.crop;
		cropPreviewActive.value = false;
	};

	const cancelCropPreview = () => {
		cropPreviewValue.value = options.crop;
		cropPreviewActive.value = false;
	};

	const run = async (request: MatteRequest) => {
		matteSchedulePending = false;
		const { first, second } = request;
		error.value = null;

		if (!first || !second) {
			processing.invalidate();
			cropProcessing.invalidate();
			processor.invalidate();
			releaseResult();
			status.value = 'idle';
			return;
		}

		const mismatch = sizeMismatch(first, second);
		if (mismatch) {
			processing.invalidate();
			cropProcessing.invalidate();
			processor.invalidate();
			releaseResult();
			status.value = 'error';
			error.value = mismatch;
			return;
		}

		const isCurrent = processing.claim();
		status.value = 'processing';
		mattePendingCount += 1;

		try {
			// Yield a frame so the processing state paints before posting work to the worker.
			await io.nextFrame();
			if (isCurrent()) {
				await produceMatte(request, isCurrent);
			}
		} finally {
			mattePendingCount -= 1;
			if (isCurrent()) {
				requestCrop(options.crop);
			}
		}
	};

	const scheduleMatte = () => {
		// Retire any in-flight run immediately so a slow encode can't land after
		// the inputs changed; a fresh run is queued behind the debounce.
		processing.invalidate();
		cropProcessing.invalidate();
		processor.invalidate();
		cropPreviewActive.value = false;
		matteSchedulePending = true;
		clearTimeout(debounce);
		debounce = setTimeout(() => {
			run(matteRequest.value).catch((error_) => {
				status.value = 'error';
				error.value = error_ instanceof Error ? error_.message : String(error_);
			});
		}, debounceMs);
	};

	// Watching the request makes each declared matte input invalidate all of its
	// downstream output together. Vue batches same-tick changes before scheduling.
	watch(matteRequest, scheduleMatte);
	watch(() => options.crop, (crop) => {
		if (!cropPreviewActive.value) {
			cropPreviewValue.value = crop;
		}
		requestCrop(crop);
	});

	const setImage = async (slot: Slot, source: File | Promise<File>) => {
		// Claim the slot synchronously, before any async work, so a slow source
		// (e.g. fetching an example) can't overwrite a newer pick made while it
		// was still loading.
		const isCurrent = decoding[slot].claim();
		processing.invalidate();
		cropProcessing.invalidate();
		processor.invalidate();
		cropPreviewActive.value = false;

		let file: File;
		let decoded: DecodedImage;
		try {
			file = await source;
			if (!isCurrent()) {
				return;
			}
			decoded = await io.decodeImage(file);
		} catch {
			if (isCurrent()) {
				status.value = 'error';
				error.value = "Couldn't read the image. Make sure it's a valid image.";
			}

			return;
		}

		// A newer selection, a clear, or teardown superseded this load.
		if (!isCurrent()) {
			return;
		}

		// Trust the MIME type when present; fall back to the extension.
		const isLossless = file.type ? file.type === 'image/png' : /\.png$/i.test(file.name);
		const target = slot === 1 ? image1 : image2;
		const background = detectBackground(decoded.image);
		processor.setImage(slot, decoded.image);
		revokePreview(target.value);
		error.value = null;
		target.value = {
			width: decoded.image.width,
			height: decoded.image.height,
			background,
			name: file.name,
			size: file.size,
			previewUrl: io.createObjectURL(decoded.preview),
			isLossless,
		};
	};

	const clearImage = (slot: Slot) => {
		decoding[slot].invalidate();
		cropProcessing.invalidate();
		processor.invalidateCrop();
		processor.clearImage(slot);
		const target = slot === 1 ? image1 : image2;
		revokePreview(target.value);
		target.value = null;
	};

	const reset = () => {
		cropPreviewActive.value = false;
		Object.assign(options, createDefaultOptions());
	};

	onScopeDispose(() => {
		processing.invalidate();
		cropProcessing.invalidate();
		processor.dispose();
		decoding[1].invalidate();
		decoding[2].invalidate();
		clearTimeout(debounce);
		releaseResult();
		revokePreview(image1.value);
		revokePreview(image2.value);
	});

	return {
		image1,
		image2,
		options,
		result,
		cropPreviewValue,
		cropPreviewActive,
		status,
		error,
		showOutput,
		detected1,
		detected2,
		cropClippingThreshold,
		setImage,
		clearImage,
		reset,
		startCropPreview,
		updateCropPreview,
		endCropPreview,
		cancelCropPreview,
	};
};

export type MattingStore = ReturnType<typeof createMattingStore>;

const mattingKey: InjectionKey<MattingStore> = Symbol('matting');

/** Create the matting store and provide it to descendants. Call once, in the root. */
export const provideMatting = (): MattingStore => {
	const store = createMattingStore();
	provide(mattingKey, store);
	return store;
};

/** Access the matting store provided by an ancestor. */
export const useMattingStore = (): MattingStore => {
	const store = inject(mattingKey);
	if (!store) {
		throw new Error('useMattingStore() called without a provideMatting() ancestor');
	}

	return store;
};
