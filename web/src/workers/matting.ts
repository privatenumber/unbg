import { cropTransparent, differenceMatting, type RgbaImage } from '../lib/core.ts';
import type {
	ImageSlot, MattingWorkerRequest, MattingWorkerResponse,
} from '../lib/matting-protocol.ts';

type WorkerPort = {
	addEventListener: (type: 'message', listener: (event: MessageEvent<MattingWorkerRequest>) => void) => void;
	postMessage: (message: MattingWorkerResponse) => void;
};

const worker = globalThis as unknown as WorkerPort;
const images: Record<ImageSlot, RgbaImage | undefined> = {
	1: undefined,
	2: undefined,
};
let revision = 0;

const yieldToMessageQueue = () => new Promise<void>((resolve) => {
	setTimeout(resolve);
});

const encodePng = async ({ data, width, height }: RgbaImage) => {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not acquire a 2D canvas context');
	}

	const clamped = new Uint8ClampedArray(
		data.buffer as ArrayBuffer,
		data.byteOffset,
		data.byteLength,
	);
	context.putImageData(new ImageData(clamped, width, height), 0, 0);
	return canvas.convertToBlob({ type: 'image/png' });
};

type MatteRequest = Extract<MattingWorkerRequest, { type: 'matte' }>;

const sendError = (requestId: number, message: string) => {
	worker.postMessage({
		type: 'error',
		requestId,
		message,
	});
};

const runMatte = async (request: MatteRequest) => {
	revision += 1;
	const operationRevision = revision;
	const image1 = images[1];
	const image2 = images[2];
	if (!image1 || !image2) {
		sendError(request.requestId, 'Both images must be loaded before matting');
		return;
	}

	try {
		const matte = differenceMatting(image1, image2, request.options);
		const imageData = request.crop ? cropTransparent(matte) : matte;
		// Let queued image changes cancel this request before PNG encoding starts.
		await yieldToMessageQueue();
		if (operationRevision !== revision) {
			return;
		}

		const image = await encodePng(imageData);
		if (operationRevision !== revision) {
			return;
		}

		worker.postMessage({
			type: 'result',
			requestId: request.requestId,
			output: {
				image,
				width: imageData.width,
				height: imageData.height,
				background1: matte.background1,
				background2: matte.background2,
				backgroundDistance: matte.backgroundDistance,
			},
		});
	} catch (error) {
		if (operationRevision === revision) {
			sendError(request.requestId, error instanceof Error ? error.message : String(error));
		}
	}
};

worker.addEventListener('message', ({ data }: MessageEvent<MattingWorkerRequest>) => {
	switch (data.type) {
		case 'set-image': {
			images[data.slot] = data.image;
			revision += 1;
			break;
		}
		case 'clear-image': {
			images[data.slot] = undefined;
			revision += 1;
			break;
		}
		case 'invalidate': {
			revision += 1;
			break;
		}
		case 'matte': {
			runMatte(data).catch((error) => {
				sendError(data.requestId, error instanceof Error ? error.message : String(error));
			});
			break;
		}
		default: {
			break;
		}
	}
});
