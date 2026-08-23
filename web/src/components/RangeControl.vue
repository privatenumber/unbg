<script setup lang="ts">
defineProps<{
	label: string;
	min: number;
	max: number;
	step: number;
	display?: string;
	hint?: string;
}>();

const model = defineModel<number>({ required: true });
</script>

<template>
	<label class="block">
		<div class="mb-2 flex items-baseline justify-between gap-3">
			<span class="text-sm text-zinc-300">{{ label }}</span>
			<span class="font-mono text-xs tabular-nums text-zinc-500">{{ display ?? model }}</span>
		</div>
		<input
			v-model.number="model"
			type="range"
			:min="min"
			:max="max"
			:step="step"
		>
		<p
			v-if="hint"
			class="mt-2 text-xs leading-relaxed text-zinc-600"
		>
			{{ hint }}
		</p>
	</label>
</template>
