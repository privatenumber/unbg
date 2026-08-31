import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import CropControl from '../../src/components/CropControl.vue';

describe('CropControl', () => {
	test('keeps the slider mounted while previewing Off and commits only on change', async () => {
		const wrapper = mount(CropControl, {
			props: {
				clippingThreshold: 0.2,
				modelValue: true,
			},
		});
		const slider = wrapper.get<HTMLInputElement>('[data-crop-slider]');
		const sliderElement = slider.element;

		await slider.trigger('pointerdown');
		slider.element.value = '0';
		await slider.trigger('input');

		expect(wrapper.emitted('preview')?.at(-1)).toStrictEqual([false]);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(wrapper.get('[data-crop-slider]').element).toBe(sliderElement);
		expect(wrapper.text()).toContain('Cropping is off');

		await slider.trigger('change');

		expect(wrapper.emitted('update:modelValue')).toStrictEqual([[false]]);
		expect(wrapper.emitted('preview-end')).toHaveLength(1);
	});
});
