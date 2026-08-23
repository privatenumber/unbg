<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
	hint: string;
}>();

const floor = defineModel<number>('floor', { required: true });
const ceiling = defineModel<number>('ceiling', { required: true });
const activeHandle = ref<'floor' | 'ceiling'>('ceiling');

const updateClosestHandle = (event: PointerEvent) => {
	if (event.target instanceof HTMLInputElement) {
		return;
	}

	const track = event.currentTarget as HTMLDivElement;
	const position = (event.clientX - track.getBoundingClientRect().left) / track.clientWidth;
	const value = Math.round(Math.min(Math.max(position, 0), 1) * 100) / 100;
	if (value - floor.value <= ceiling.value - value) {
		floor.value = Math.min(value, ceiling.value);
		activeHandle.value = 'floor';
		return;
	}

	ceiling.value = Math.max(value, floor.value);
	activeHandle.value = 'ceiling';
};
</script>

<template>
	<fieldset class="block">
		<legend class="mb-2 flex items-baseline justify-between gap-3">
			<span class="text-sm text-zinc-300">
				Alpha thresholds
			</span>
			<span class="font-mono text-xs tabular-nums text-zinc-500">
				{{ floor.toFixed(2) }} - {{ ceiling.toFixed(2) }}
			</span>
		</legend>
		<div
			class="alpha-range"
			@pointerdown="updateClosestHandle"
		>
			<div
				class="alpha-range-selection"
				:style="{
					left: `${floor * 100}%`,
					right: `${(1 - ceiling) * 100}%`,
				}"
			/>
			<input
				v-model.number="floor"
				class="alpha-range-input"
				:class="{ 'alpha-range-input-active': activeHandle === 'floor' }"
				type="range"
				min="0"
				:max="ceiling"
				step="0.01"
				aria-label="Alpha floor"
				:aria-valuetext="`Floor ${floor.toFixed(2)}`"
				@pointerdown="activeHandle = 'floor'"
			>
			<input
				v-model.number="ceiling"
				class="alpha-range-input"
				:class="{ 'alpha-range-input-active': activeHandle === 'ceiling' }"
				type="range"
				:min="floor"
				max="1"
				step="0.01"
				aria-label="Alpha ceiling"
				:aria-valuetext="`Ceiling ${ceiling.toFixed(2)}`"
				@pointerdown="activeHandle = 'ceiling'"
			>
		</div>
		<p class="mt-2 text-xs leading-relaxed text-zinc-600">
			{{ hint }}
		</p>
	</fieldset>
</template>

<style scoped>
.alpha-range {
	position: relative;
	display: flex;
	align-items: center;
	height: var(--slider-thumb-size);
}

.alpha-range::before {
	position: absolute;
	inset-inline: 0;
	height: var(--slider-track-height);
	border-radius: 999px;
	background: var(--color-line);
	content: '';
}

.alpha-range-selection {
	position: absolute;
	top: 50%;
	height: var(--slider-track-height);
	border-radius: inherit;
	background: var(--color-accent);
	pointer-events: none;
	transform: translateY(-50%);
}

.alpha-range-input {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: var(--slider-thumb-size);
	margin: 0;
	appearance: none;
	-webkit-appearance: none;
	background: transparent;
	pointer-events: none;
}

.alpha-range-input::-webkit-slider-runnable-track {
	height: var(--slider-track-height);
	background: transparent;
}

.alpha-range-input::-webkit-slider-thumb {
	margin-top: calc((var(--slider-track-height) - var(--slider-thumb-size)) / 2);
	pointer-events: auto;
}

.alpha-range-input::-moz-range-track {
	height: var(--slider-track-height);
	background: transparent;
}

.alpha-range-input::-moz-range-thumb {
	pointer-events: auto;
}

.alpha-range-input-active {
	z-index: 1;
}

</style>
