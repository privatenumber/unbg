<script setup lang="ts">
import { computed, ref, watch } from 'vue';

defineProps<{
	label: string;
	min: number;
	max: number;
	step: number;
	hint?: string;
}>();

const model = defineModel<number>({ required: true });
const draft = ref<number | null>(null);
const value = computed(() => draft.value ?? model.value);

watch(model, () => {
	if (draft.value === null) {
		return;
	}

	draft.value = null;
});

const onInput = (event: Event) => {
	draft.value = Number((event.currentTarget as HTMLInputElement).value);
};

const commit = () => {
	if (draft.value === null) {
		return;
	}

	model.value = draft.value;
	draft.value = null;
};

const cancel = () => {
	draft.value = null;
};
</script>

<template>
	<label class="block">
		<div class="mb-2 flex items-baseline justify-between gap-3">
			<span class="text-sm text-zinc-300">{{ label }}</span>
			<span class="font-mono text-xs tabular-nums text-zinc-500">{{ value }}</span>
		</div>
		<input
			:value="value"
			type="range"
			:min="min"
			:max="max"
			:step="step"
			@blur="cancel"
			@change="commit"
			@input="onInput"
			@pointercancel="cancel"
		>
		<p
			v-if="hint"
			class="mt-2 text-xs leading-relaxed text-zinc-600"
		>
			{{ hint }}
		</p>
	</label>
</template>
