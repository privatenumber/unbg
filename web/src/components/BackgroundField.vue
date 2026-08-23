<script setup lang="ts">
import { computed, watch } from 'vue';
import type { Rgb } from '../lib/core.ts';
import { hexToRgb, rgbToCss, rgbToHex } from '../lib/format.ts';

const props = defineProps<{
	label: string;
	detected: Rgb | null;
}>();

const auto = defineModel<boolean>('auto', { required: true });
const color = defineModel<Rgb>('color', { required: true });

const swatch = computed(() => (auto.value && props.detected ? props.detected : color.value));

const hex = computed({
	get: () => rgbToHex(color.value),
	set: (value: string) => { color.value = hexToRgb(value); },
});

// Seed the manual color with the detected value when switching off auto.
watch(auto, (isAuto) => {
	if (!isAuto && props.detected) {
		color.value = { ...props.detected };
	}
});
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<div class="rounded-xl border border-line bg-surface-2/60 p-3.5">
		<div class="flex items-center justify-between gap-3">
			<span class="text-sm text-zinc-300">{{ label }}</span>
			<button
				type="button"
				class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
				:class="auto
					? 'bg-accent/15 text-accent'
					: 'bg-surface text-zinc-500 hover:text-zinc-300'"
				@click="auto = !auto"
			>
				{{ auto ? 'Auto' : 'Manual' }}
			</button>
		</div>

		<div class="mt-3 flex items-center gap-2.5">
			<span
				class="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-line"
			>
				<span class="checkerboard absolute inset-0" />
				<span
					class="absolute inset-0"
					:style="{ background: rgbToCss(swatch) }"
				/>
				<input
					v-if="!auto"
					v-model="hex"
					type="color"
					class="absolute inset-0 size-full opacity-0"
					title="Pick a color"
				>
			</span>

			<code class="font-mono text-xs text-zinc-500">{{ rgbToCss(swatch) }}</code>
			<span
				v-if="auto"
				class="text-[11px] text-zinc-600"
			>from corners</span>
		</div>
	</div>
</template>
