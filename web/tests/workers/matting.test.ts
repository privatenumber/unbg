// @vitest-environment node
import {
	afterEach, describe, expect, test, vi,
} from 'vitest';
import type { RgbaImage } from '../../src/lib/core.ts';
import type { MattingWorkerRequest, MattingWorkerResponse } from '../../src/lib/matting-protocol.ts';

type WorkerListener = (event: MessageEvent<MattingWorkerRequest>) => void;

const solidImage = (r: number, g: number, b: number): RgbaImage => ({
	data: new Uint8Array([
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
		r,
		g,
		b,
		255,
	]),
	width: 3,
	height: 3,
});

const tick = () => new Promise((resolve) => {
	setTimeout(resolve, 0);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('matting worker', () => {
	test('serves crop-only requests from its cached matte and drops invalidated cache', async () => {
		let listener: WorkerListener | undefined;
		const responses: MattingWorkerResponse[] = [];
		vi.stubGlobal('addEventListener', (_type: string, nextListener: WorkerListener) => {
			listener = nextListener;
		});
		vi.stubGlobal('postMessage', (response: MattingWorkerResponse) => {
			responses.push(response);
		});
		vi.stubGlobal('ImageData', class {});
		vi.stubGlobal('OffscreenCanvas', class {
			getContext = () => ({
				putImageData: () => {},
			});

			convertToBlob = () => Promise.resolve(new Blob(['png'], { type: 'image/png' }));
		});

		await import('../../src/workers/matting.ts');
		if (!listener) {
			throw new Error('Expected worker message listener');
		}

		listener({
			data: {
				type: 'set-image',
				slot: 1,
				image: solidImage(255, 255, 255),
			},
		} as MessageEvent<MattingWorkerRequest>);
		listener({
			data: {
				type: 'set-image',
				slot: 2,
				image: solidImage(0, 0, 0),
			},
		} as MessageEvent<MattingWorkerRequest>);
		listener({
			data: {
				type: 'matte',
				requestId: 1,
				crop: true,
				options: {
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
				},
			},
		} as MessageEvent<MattingWorkerRequest>);
		await tick();
		await tick();

		expect(responses[0]).toMatchObject({
			type: 'matte-result',
			requestId: 1,
		});

		listener({
			data: {
				type: 'crop',
				requestId: 2,
				crop: false,
			},
		} as MessageEvent<MattingWorkerRequest>);
		await tick();
		await tick();

		expect(responses[1]).toMatchObject({
			type: 'crop-result',
			requestId: 2,
			output: {
				width: 3,
				height: 3,
				crop: false,
			},
		});

		listener({ data: { type: 'invalidate' } } as MessageEvent<MattingWorkerRequest>);
		listener({
			data: {
				type: 'crop',
				requestId: 3,
				crop: true,
			},
		} as MessageEvent<MattingWorkerRequest>);
		await tick();

		expect(responses[2]).toMatchObject({
			type: 'error',
			requestId: 3,
			message: 'A matte must be generated before cropping',
		});
	});
});
