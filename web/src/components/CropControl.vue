<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CropValue } from '../lib/matting-protocol.ts';

const sliderMaximum = 256;
const sliderAutomaticValue = 1;
const sliderThresholdOffset = 2;

const props = defineProps<{
	clippingThreshold: number | null;
}>();

const crop = defineModel<CropValue>({ required: true });
const emit = defineEmits<{
	'preview-start': [value: CropValue];
	preview: [value: CropValue];
	'preview-end': [];
	'preview-cancel': [];
}>();

const cropToSlider = (value: CropValue) => {
	if (value === false) {
		return 0;
	}
	if (value === true) {
		return sliderAutomaticValue;
	}

	return Math.min(
		sliderMaximum,
		sliderThresholdOffset + Math.round(value * 255),
	);
};

const sliderToCrop = (value: number): CropValue => {
	if (value === 0) {
		return false;
	}
	if (value === sliderAutomaticValue) {
		return true;
	}

	return (value - sliderThresholdOffset) / 255;
};

const draftSliderValue = ref<number | null>(null);
const isInteracting = ref(false);
const sliderValue = computed(() => draftSliderValue.value ?? cropToSlider(crop.value));
const displayCrop = computed(() => (
	draftSliderValue.value === null ? crop.value : sliderToCrop(draftSliderValue.value)
));

watch(crop, () => {
	draftSliderValue.value = null;
});

const startPreview = () => {
	if (isInteracting.value) {
		return;
	}

	isInteracting.value = true;
	draftSliderValue.value = cropToSlider(crop.value);
	emit('preview-start', crop.value);
};

const updatePreview = (value: number) => {
	startPreview();
	draftSliderValue.value = value;
	emit('preview', sliderToCrop(value));
};

const readSliderValue = (event: Event) => Number((event.currentTarget as HTMLInputElement).value);

const onInput = (event: Event) => {
	updatePreview(readSliderValue(event));
};

const commitPreview = () => {
	if (draftSliderValue.value !== null) {
		crop.value = sliderToCrop(draftSliderValue.value);
		draftSliderValue.value = null;
	}
};

const endPreview = () => {
	if (!isInteracting.value) {
		return;
	}

	draftSliderValue.value = null;
	isInteracting.value = false;
	emit('preview-end');
};

const onChange = () => {
	commitPreview();
	endPreview();
};

const cancelPreview = () => {
	draftSliderValue.value = null;
	isInteracting.value = false;
	emit('preview-cancel');
};

const formatPercentage = (value: number) => {
	const percentage = Math.round(value * 1000) / 10;
	return `${percentage}%`;
};

const displayValue = computed(() => {
	if (displayCrop.value === false) {
		return 'Off';
	}
	if (displayCrop.value === true) {
		return 'Auto';
	}

	return formatPercentage(displayCrop.value);
});

const clippingPosition = computed(() => (
	props.clippingThreshold === null
		? null
		: (Math.min(
			sliderMaximum,
			sliderThresholdOffset + props.clippingThreshold * 255,
		) / sliderMaximum) * 100
));

const isClipping = computed(() => {
	const threshold = displayCrop.value;
	return typeof threshold === 'number'
		&& props.clippingThreshold !== null
		&& threshold >= props.clippingThreshold;
});

const cropHint = computed(() => {
	if (displayCrop.value === false) {
		return 'Cropping is off. Hold the slider to inspect the crop boundary.';
	}
	if (displayCrop.value === true) {
		return 'Automatically trim edges with fewer than 1% visible pixels.';
	}

	return 'Ignore pixels at or below this opacity when finding the crop bounds.';
});
</script>

<template>
	<fieldset class="block">
		<legend class="mb-2 flex items-baseline justify-between gap-3">
			<span class="text-sm text-zinc-300">Crop threshold</span>
			<span class="font-mono text-xs tabular-nums text-zinc-500">{{ displayValue }}</span>
		</legend>
		<div class="relative flex h-4 items-center">
			<input
				:value="sliderValue"
				type="range"
				min="0"
				:max="sliderMaximum"
				step="1"
				aria-label="Crop threshold"
				:aria-valuetext="displayValue"
				data-crop-slider
				@change="onChange"
				@focus="startPreview"
				@blur="endPreview"
				@input="onInput"
				@keydown.esc.prevent="cancelPreview"
				@pointercancel="cancelPreview"
				@pointerdown="startPreview"
			>
			<span
				v-if="clippingPosition !== null"
				aria-hidden="true"
				class="pointer-events-none absolute top-1/2 z-10 h-4 w-px -translate-x-1/2 -translate-y-1/2"
				:class="isClipping ? 'bg-amber-400' : 'bg-zinc-600'"
				:style="{ left: `${clippingPosition}%` }"
			/>
		</div>
		<div class="mt-1 flex justify-between text-[11px] text-zinc-600">
			<span>Off</span>
			<span>99.6%</span>
		</div>
		<p
			v-if="clippingThreshold !== null"
			class="mt-2 text-xs leading-relaxed"
			:class="isClipping ? 'text-amber-400/80' : 'text-zinc-600'"
		>
			Manual threshold starts clipping non-transparent pixels at
			{{ formatPercentage(clippingThreshold) }}.
		</p>
		<div class="mt-2 min-h-12 text-xs leading-relaxed text-zinc-600">
			<p>{{ cropHint }}</p>
			<p>
				Hold the slider to inspect excluded pixels. Blue pixels are cropped; red marks
				the retained edge.
			</p>
		</div>
	</fieldset>
</template>
