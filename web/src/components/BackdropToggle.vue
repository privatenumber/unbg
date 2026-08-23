<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IconPlus } from '../icons.ts';

// Resolved CSS background color for the preview; null means transparent (checkerboard).
const model = defineModel<string | null>({ default: null });

type BackdropId = 'checker' | 'white' | 'gray' | 'black' | 'custom';

const colorPresets = [
	{
		id: 'white',
		label: 'White',
		color: '#ffffff',
	},
	{
		id: 'gray',
		label: 'Gray',
		color: '#808080',
	},
	{
		id: 'black',
		label: 'Black',
		color: '#000000',
	},
] as const;

const backdrop = ref<BackdropId>('checker');
const customColor = ref('#3b82f6');

const activeColor = computed(() => {
	if (backdrop.value === 'checker') {
		return null;
	}

	if (backdrop.value === 'custom') {
		return customColor.value;
	}

	return colorPresets.find(preset => preset.id === backdrop.value)?.color ?? null;
});

watch(activeColor, (value) => {
	model.value = value;
}, { immediate: true });
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<div
		role="group"
		aria-label="Preview backdrop"
		class="flex items-center gap-1 rounded-full border border-line bg-surface/70 p-1 backdrop-blur"
	>
		<button
			type="button"
			title="Transparent (checkerboard)"
			aria-label="Transparent checkerboard backdrop"
			class="checker-swatch size-5 rounded-full ring-white ring-offset-2 ring-offset-surface transition"
			:class="backdrop === 'checker' ? 'ring-2' : ''"
			@click="backdrop = 'checker'"
		/>
		<button
			v-for="preset in colorPresets"
			:key="preset.id"
			type="button"
			:title="`Preview on ${preset.label.toLowerCase()}`"
			:aria-label="`${preset.label} backdrop`"
			class="size-5 rounded-full border border-line/60 ring-white ring-offset-2 ring-offset-surface transition"
			:class="backdrop === preset.id ? 'ring-2' : ''"
			:style="{ backgroundColor: preset.color }"
			@click="backdrop = preset.id"
		/>
		<label
			title="Preview on a custom color"
			class="relative grid size-5 cursor-pointer place-items-center rounded-full ring-white ring-offset-2 ring-offset-surface transition"
			:class="backdrop === 'custom' ? 'ring-2' : ''"
			:style="{ backgroundColor: customColor }"
			@click="backdrop = 'custom'"
		>
			<IconPlus class="size-3 text-white mix-blend-difference" />
			<input
				v-model="customColor"
				type="color"
				class="absolute inset-0 size-full cursor-pointer opacity-0"
				aria-label="Custom backdrop color"
				@input="backdrop = 'custom'"
			>
		</label>
	</div>
</template>
