import type { DifferenceMattingOptions, Rgb, RgbaImage } from './core.ts';

export type ImageSlot = 1 | 2;

export type MattingOutput = {
	image: Blob;
	width: number;
	height: number;
	background1: Rgb;
	background2: Rgb;
	backgroundDistance: number;
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
		type: 'matte';
		requestId: number;
		options: DifferenceMattingOptions;
	};

export type MattingWorkerResponse =
	| {
		type: 'result';
		requestId: number;
		output: MattingOutput;
	}
	| {
		type: 'error';
		requestId: number;
		message: string;
	};
