import type {
	ContentBounds, DifferenceMattingOptions, Rgb, RgbaImage,
} from './core.ts';

export type ImageSlot = 1 | 2;

export type CropValue = boolean | number;

export type CropMetadata = {
	width: number;
	height: number;
	automaticBounds: ContentBounds | null;

	/** Four values per alpha threshold: x, y, width, height. Width 0 means null. */
	manualBounds: Int32Array;
};

export type MattingOutput = {
	image: Blob;
	mattePreview: Blob;
	width: number;
	height: number;
	crop: CropValue;
	cropMetadata: CropMetadata;
	background1: Rgb;
	background2: Rgb;
	backgroundDistance: number;
	cropClippingThreshold: number | null;
};

export type CropOutput = {
	image: Blob;
	width: number;
	height: number;
	crop: CropValue;
};

export type MattingWorkerRequest =
	| {
		type: 'set-image';
		slot: ImageSlot;
		image: RgbaImage;
	}
	| {
		type: 'clear-image';
		slot: ImageSlot;
	}
	| {
		type: 'invalidate';
	}
	| {
		type: 'invalidate-crop';
	}
	| {
		type: 'matte';
		requestId: number;
		options: DifferenceMattingOptions;
		crop: CropValue;
	}
	| {
		type: 'crop';
		requestId: number;
		crop: CropValue;
	};

export type MattingWorkerResponse =
	| {
		type: 'matte-result';
		requestId: number;
		output: MattingOutput;
	}
	| {
		type: 'crop-result';
		requestId: number;
		output: CropOutput;
	}
	| {
		type: 'error';
		requestId: number;
		message: string;
	};
