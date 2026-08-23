<script setup lang="ts">
import { useMattingStore } from '../composables/use-matting.ts';
import AlphaRangeControl from './AlphaRangeControl.vue';
import BackgroundField from './BackgroundField.vue';
import Disclosure from './Disclosure.vue';
import RangeControl from './RangeControl.vue';

const {
	options, detected1, detected2, reset,
} = useMattingStore();
</script>

<template>
	<Disclosure title="Advanced controls">
		<div class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
			<BackgroundField
				v-model:auto="options.bg1Auto"
				v-model:color="options.bg1"
				label="Background 1"
				:detected="detected1"
			/>
			<BackgroundField
				v-model:auto="options.bg2Auto"
				v-model:color="options.bg2"
				label="Background 2"
				:detected="detected2"
			/>

			<RangeControl
				v-model="options.threshold"
				label="Channel threshold"
				:min="0"
				:max="255"
				:step="1"
				:display="String(options.threshold)"
				hint="Minimum per-channel background difference for a channel to inform the alpha estimate."
			/>
			<AlphaRangeControl
				v-model:floor="options.floor"
				v-model:ceiling="options.ceiling"
				hint="Snap alpha outside the selected range to transparent or opaque."
			/>
		</div>

		<div class="mt-5 flex justify-end">
			<button
				type="button"
				class="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
				@click="reset"
			>
				Reset to defaults
			</button>
		</div>
	</Disclosure>
</template>
