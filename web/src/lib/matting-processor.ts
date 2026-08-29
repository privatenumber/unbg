import type { DifferenceMattingOptions, RgbaImage } from './core.ts';
import type {
	ImageSlot, MattingOutput, MattingWorkerRequest, MattingWorkerResponse,
} from './matting-protocol.ts';

export type MattingProcessor = {
	setImage: (slot: ImageSlot, image: RgbaImage) => void;
	clearImage: (slot: ImageSlot) => void;
	matte: (options: DifferenceMattingOptions, crop: boolean) => Promise<MattingOutput>;
	invalidate: () => void;
	dispose: () => void;
};

export const createMattingProcessor = (): MattingProcessor => {
	const worker = new Worker(new URL('../workers/matting.ts', import.meta.url), { type: 'module' });
	const pending = new Map<number, PromiseWithResolvers<MattingOutput>>();
	let nextRequestId = 0;

	const rejectPending = (message: string) => {
		for (const deferred of pending.values()) {
			deferred.reject(new Error(message));
		}
		pending.clear();
	};

	worker.addEventListener('message', ({ data }: MessageEvent<MattingWorkerResponse>) => {
		const deferred = pending.get(data.requestId);
		if (!deferred) {
			return;
		}

		pending.delete(data.requestId);
		if (data.type === 'result') {
			deferred.resolve(data.output);
		} else {
			deferred.reject(new Error(data.message));
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
			pending.set(nextRequestId, deferred);
			worker.postMessage({
				type: 'matte',
				requestId: nextRequestId,
				options,
				crop,
			} satisfies MattingWorkerRequest);
			return deferred.promise;
		},
		invalidate: () => {
			worker.postMessage({ type: 'invalidate' } satisfies MattingWorkerRequest);
			rejectPending('Matte request superseded');
		},
		dispose: () => {
			rejectPending('Matting worker disposed');
			worker.terminate();
		},
	};
};
