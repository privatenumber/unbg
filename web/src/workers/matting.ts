import {
	cropImage,
	differenceMatting,
	type RgbaImage,
} from '../lib/core.ts';
import { createCropMetadata, getCropBounds } from '../lib/manual-crop-bounds.ts';
import type {
	CropMetadata, CropValue, ImageSlot, MattingWorkerRequest, MattingWorkerResponse,
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
let cropRevision = 0;
let cachedMatte: {
	image: ReturnType<typeof differenceMatting>;
	metadata: CropMetadata;
} | undefined;

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
type CropRequest = Extract<MattingWorkerRequest, { type: 'crop' }>;

const cropMatte = (
	matte: {
		image: ReturnType<typeof differenceMatting>;
		metadata: CropMetadata;
	},
	crop: CropValue,
) => {
	const bounds = getCropBounds(matte.metadata, crop);
	return bounds === undefined ? matte.image : cropImage(matte.image, bounds);
};

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
	cropRevision += 1;
	cachedMatte = undefined;
	const image1 = images[1];
	const image2 = images[2];
	if (!image1 || !image2) {
		sendError(request.requestId, 'Both images must be loaded before matting');
		return;
	}

	try {
		const image = differenceMatting(image1, image2, request.options);
		const metadata = createCropMetadata(image);
		if (operationRevision !== revision) {
			return;
		}

		const matte = {
			image,
			metadata,
		};
		cachedMatte = matte;
		const imageData = cropMatte(matte, request.crop);
		// Let queued image changes cancel this request before PNG encoding starts.
		await yieldToMessageQueue();
		if (operationRevision !== revision) {
			return;
		}

		const mattePreviewPromise = encodePng(image);
		const imagePromise = imageData === image ? mattePreviewPromise : encodePng(imageData);
		const [mattePreview, outputImage] = await Promise.all([
			mattePreviewPromise,
			imagePromise,
		]);
		if (operationRevision !== revision) {
			return;
		}

		worker.postMessage({
			type: 'matte-result',
			requestId: request.requestId,
			output: {
				image: outputImage,
				mattePreview,
				width: imageData.width,
				height: imageData.height,
				crop: request.crop,
				cropMetadata: metadata,
				background1: image.background1,
				background2: image.background2,
				backgroundDistance: image.backgroundDistance,
				cropClippingThreshold: image.cropClippingThreshold,
			},
		});
	} catch (error) {
		if (operationRevision === revision) {
			sendError(request.requestId, error instanceof Error ? error.message : String(error));
		}
	}
};

const runCrop = async (request: CropRequest) => {
	cropRevision += 1;
	const operationRevision = cropRevision;
	const matte = cachedMatte;
	if (!matte) {
		sendError(request.requestId, 'A matte must be generated before cropping');
		return;
	}

	try {
		const image = cropMatte(matte, request.crop);
		await yieldToMessageQueue();
		if (operationRevision !== cropRevision || cachedMatte !== matte) {
			return;
		}

		const outputImage = await encodePng(image);
		if (operationRevision !== cropRevision || cachedMatte !== matte) {
			return;
		}

		worker.postMessage({
			type: 'crop-result',
			requestId: request.requestId,
			output: {
				image: outputImage,
				width: image.width,
				height: image.height,
				crop: request.crop,
			},
		});
	} catch (error) {
		if (operationRevision === cropRevision) {
			sendError(request.requestId, error instanceof Error ? error.message : String(error));
		}
	}
};

worker.addEventListener('message', ({ data }: MessageEvent<MattingWorkerRequest>) => {
	switch (data.type) {
		case 'set-image': {
			images[data.slot] = data.image;
			revision += 1;
			cropRevision += 1;
			cachedMatte = undefined;
			break;
		}
		case 'clear-image': {
			images[data.slot] = undefined;
			revision += 1;
			cropRevision += 1;
			cachedMatte = undefined;
			break;
		}
		case 'invalidate': {
			revision += 1;
			cropRevision += 1;
			cachedMatte = undefined;
			break;
		}
		case 'invalidate-crop': {
			cropRevision += 1;
			break;
		}
		case 'matte': {
			runMatte(data).catch((error) => {
				sendError(data.requestId, error instanceof Error ? error.message : String(error));
			});
			break;
		}
		case 'crop': {
			runCrop(data).catch((error) => {
				sendError(data.requestId, error instanceof Error ? error.message : String(error));
			});
			break;
		}
		default: {
			break;
		}
	}
});
