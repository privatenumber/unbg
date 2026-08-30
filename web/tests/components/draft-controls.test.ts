import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import AlphaRangeControl from '../../src/components/AlphaRangeControl.vue';
import BackgroundField from '../../src/components/BackgroundField.vue';
import RangeControl from '../../src/components/RangeControl.vue';

describe('draft controls', () => {
	test('commits a range value only after change', async () => {
		const wrapper = mount(RangeControl, {
			props: {
				label: 'Channel threshold',
				min: 0,
				max: 255,
				step: 1,
				modelValue: 10,
			},
		});
		const input = wrapper.get<HTMLInputElement>('input');
		input.element.value = '20';
		await input.trigger('input');

		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(wrapper.text()).toContain('20');

		await input.trigger('change');

		expect(wrapper.emitted('update:modelValue')).toStrictEqual([[20]]);
	});

	test('commits alpha handles only after change', async () => {
		const wrapper = mount(AlphaRangeControl, {
			props: {
				floor: 0.1,
				ceiling: 0.9,
				hint: 'Snap alpha outside the selected range.',
			},
		});
		const floor = wrapper.findAll<HTMLInputElement>('input')[0];
		floor.element.value = '0.2';
		await floor.trigger('input');

		expect(wrapper.emitted('update:floor')).toBeUndefined();
		expect(wrapper.text()).toContain('0.20 - 0.90');

		await floor.trigger('change');

		expect(wrapper.emitted('update:floor')).toStrictEqual([[0.2]]);
	});

	test('commits a manual background color only after change', async () => {
		const wrapper = mount(BackgroundField, {
			props: {
				auto: false,
				color: {
					r: 0,
					g: 0,
					b: 0,
				},
				label: 'Background 1',
				detected: null,
			},
		});
		const input = wrapper.get<HTMLInputElement>('input[type="color"]');
		input.element.value = '#ff0000';
		await input.trigger('input');

		expect(wrapper.emitted('update:color')).toBeUndefined();
		expect(wrapper.text()).toContain('rgb(255 0 0)');

		await input.trigger('change');

		expect(wrapper.emitted('update:color')).toStrictEqual([[
			{
				r: 255,
				g: 0,
				b: 0,
			},
		]]);
	});
});
