import { mount } from '@vue/test-utils';
import {
	afterEach, describe, expect, test, vi,
} from 'vitest';
import ResultPanel from '../../src/components/ResultPanel.vue';

const state = vi.hoisted(() => ({
	status: 'idle' as 'idle' | 'processing',
	result: {
		url: 'blob:result',
		mattePreviewUrl: '',
		width: 100,
		height: 100,
		crop: true,
		cropMetadata: {
			width: 100,
			height: 100,
			automaticBounds: {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			},
			manualBounds: new Int32Array(),
		},
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
		backgroundDistance: 100,
		cropClippingThreshold: null,
		size: 1,
	},
}));

vi.mock('../../src/composables/use-matting.ts', async () => {
	const { ref } = await import('vue');
	return {
		useMattingStore: () => ({
			image1: ref(null),
			image2: ref(null),
			result: ref(state.result),
			status: ref(state.status),
			error: ref(null),
		}),
	};
});

afterEach(() => {
	state.status = 'idle';
});

describe('ResultPanel', () => {
	test('removes stale downloads while processing a replacement', () => {
		state.status = 'processing';

		const wrapper = mount(ResultPanel);

		expect(wrapper.find('a[download]').exists()).toBe(false);
	});

	test('downloads the current result when idle', () => {
		const wrapper = mount(ResultPanel);

		expect(wrapper.get('a[download]').attributes('href')).toBe('blob:result');
	});
});
