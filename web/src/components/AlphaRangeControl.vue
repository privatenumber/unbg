<script setup lang="ts">
import { ref, watch } from 'vue';

defineProps<{
	hint: string;
}>();

const floor = defineModel<number>('floor', { required: true });
const ceiling = defineModel<number>('ceiling', { required: true });
const activeHandle = ref<'floor' | 'ceiling'>('ceiling');
const draftFloor = ref(floor.value);
const draftCeiling = ref(ceiling.value);

watch([floor, ceiling], ([nextFloor, nextCeiling]) => {
	draftFloor.value = nextFloor;
	draftCeiling.value = nextCeiling;
});

const readValue = (event: Event) => Number((event.currentTarget as HTMLInputElement).value);

const updateFloor = (event: Event) => {
	draftFloor.value = Math.min(readValue(event), draftCeiling.value);
};

const updateCeiling = (event: Event) => {
	draftCeiling.value = Math.max(readValue(event), draftFloor.value);
};

const commit = () => {
	if (floor.value !== draftFloor.value) {
		floor.value = draftFloor.value;
	}
	if (ceiling.value !== draftCeiling.value) {
		ceiling.value = draftCeiling.value;
	}
};

const cancel = () => {
	draftFloor.value = floor.value;
	draftCeiling.value = ceiling.value;
};

const updateClosestHandle = (event: PointerEvent) => {
	if (event.target instanceof HTMLInputElement) {
		return;
	}

	const track = event.currentTarget as HTMLDivElement;
	const position = (event.clientX - track.getBoundingClientRect().left) / track.clientWidth;
	const value = Math.round(Math.min(Math.max(position, 0), 1) * 100) / 100;
	if (value - draftFloor.value <= draftCeiling.value - value) {
		draftFloor.value = Math.min(value, draftCeiling.value);
		activeHandle.value = 'floor';
	} else {
		draftCeiling.value = Math.max(value, draftFloor.value);
		activeHandle.value = 'ceiling';
	}

	commit();
};
</script>

<template>
	<fieldset class="block">
		<legend class="mb-2 flex items-baseline justify-between gap-3">
			<span class="text-sm text-zinc-300">
				Alpha thresholds
			</span>
			<span class="font-mono text-xs tabular-nums text-zinc-500">
				{{ draftFloor.toFixed(2) }} - {{ draftCeiling.toFixed(2) }}
			</span>
		</legend>
		<div
			class="alpha-range"
			@pointerdown="updateClosestHandle"
		>
			<div
				class="alpha-range-selection"
				:style="{
					left: `${draftFloor * 100}%`,
					right: `${(1 - draftCeiling) * 100}%`,
				}"
			/>
			<input
				:value="draftFloor"
				class="alpha-range-input"
				:class="{ 'alpha-range-input-active': activeHandle === 'floor' }"
				type="range"
				min="0"
				:max="draftCeiling"
				step="0.01"
				aria-label="Alpha floor"
				:aria-valuetext="`Floor ${draftFloor.toFixed(2)}`"
				@blur="cancel"
				@change="commit"
				@input="updateFloor"
				@pointercancel="cancel"
				@pointerdown="activeHandle = 'floor'"
			>
			<input
				:value="draftCeiling"
				class="alpha-range-input"
				:class="{ 'alpha-range-input-active': activeHandle === 'ceiling' }"
				type="range"
				:min="draftFloor"
				max="1"
				step="0.01"
				aria-label="Alpha ceiling"
				:aria-valuetext="`Ceiling ${draftCeiling.toFixed(2)}`"
				@blur="cancel"
				@change="commit"
				@input="updateCeiling"
				@pointercancel="cancel"
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
