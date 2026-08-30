import type { DifferenceMattingOptions, RgbaImage } from './core.ts';
import type {
	CropOutput,
	CropValue,
	ImageSlot,
	MattingOutput,
	MattingWorkerRequest,
	MattingWorkerResponse,
} from './matting-protocol.ts';

export type MattingProcessor = {
	setImage: (slot: ImageSlot, image: RgbaImage) => void;
	clearImage: (slot: ImageSlot) => void;
	matte: (
		options: DifferenceMattingOptions,
		crop: CropValue,
	) => Promise<MattingOutput>;
	crop: (crop: CropValue) => Promise<CropOutput>;
	invalidate: () => void;
	invalidateCrop: () => void;
	dispose: () => void;
};

export const createMattingProcessor = (): MattingProcessor => {
	const worker = new Worker(new URL('../workers/matting.ts', import.meta.url), { type: 'module' });
	type PendingRequest =
		| {
			type: 'matte';
			deferred: PromiseWithResolvers<MattingOutput>;
		}
		| {
			type: 'crop';
			deferred: PromiseWithResolvers<CropOutput>;
		};
	const pending = new Map<number, PendingRequest>();
	let nextRequestId = 0;

	const rejectPending = (message: string, type?: PendingRequest['type']) => {
		for (const [requestId, request] of pending) {
			if (type && request.type !== type) {
				continue;
			}

			request.deferred.reject(new Error(message));
			pending.delete(requestId);
		}
	};

	worker.addEventListener('message', ({ data }: MessageEvent<MattingWorkerResponse>) => {
		const deferred = pending.get(data.requestId);
		if (!deferred) {
			return;
		}

		pending.delete(data.requestId);
		if (data.type === 'error') {
			deferred.deferred.reject(new Error(data.message));
			return;
		}

		if (data.type === 'matte-result' && deferred.type === 'matte') {
			deferred.deferred.resolve(data.output);
		} else if (data.type === 'crop-result' && deferred.type === 'crop') {
			deferred.deferred.resolve(data.output);
		} else {
			deferred.deferred.reject(new Error('Unexpected matting worker response'));
		}
	});
	worker.addEventListener('error', (event) => {
		rejectPending(event.message || 'Matting worker failed');
	});

	return {
		setImage: (slot, image) => {
			if (!(image.data.buffer instanceof ArrayBuffer)) {
				throw new TypeError('Expected image pixels backed by an ArrayBuffer');
			}

			const message: MattingWorkerRequest = {
				type: 'set-image',
				slot,
				image,
			};
			worker.postMessage(message, [image.data.buffer]);
		},
		clearImage: (slot) => {
			worker.postMessage({
				type: 'clear-image',
				slot,
			} satisfies MattingWorkerRequest);
		},
		matte: (options, crop) => {
			nextRequestId += 1;
			const deferred = Promise.withResolvers<MattingOutput>();
			pending.set(nextRequestId, {
				type: 'matte',
				deferred,
			});
			worker.postMessage({
				type: 'matte',
				requestId: nextRequestId,
				options,
				crop,
			} satisfies MattingWorkerRequest);
			return deferred.promise;
		},
		crop: (crop) => {
			nextRequestId += 1;
			const deferred = Promise.withResolvers<CropOutput>();
			pending.set(nextRequestId, {
				type: 'crop',
				deferred,
			});
			worker.postMessage({
				type: 'crop',
				requestId: nextRequestId,
				crop,
			} satisfies MattingWorkerRequest);
			return deferred.promise;
		},
		invalidate: () => {
			worker.postMessage({ type: 'invalidate' } satisfies MattingWorkerRequest);
			rejectPending('Matte request superseded');
		},
		invalidateCrop: () => {
			worker.postMessage({ type: 'invalidate-crop' } satisfies MattingWorkerRequest);
			rejectPending('Crop request superseded', 'crop');
		},
		dispose: () => {
			rejectPending('Matting worker disposed');
			worker.terminate();
		},
	};
};
