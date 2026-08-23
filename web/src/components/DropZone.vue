<script setup lang="ts">
import { ref } from 'vue';
import type { LoadedImage } from '../composables/use-matting.ts';
import {
	IconCheck, IconTriangleAlert, IconUpload, IconX,
} from '../icons.ts';
import { formatBytes } from '../lib/format.ts';

defineProps<{
	step: number;
	label: string;
	hint: string;
	image: LoadedImage | null;
}>();

const emit = defineEmits<{
	select: [file: File];
	clear: [];
}>();

const input = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

const pick = () => input.value?.click();

const onInput = (event: Event) => {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (file) {
		emit('select', file);
	}
	(event.target as HTMLInputElement).value = '';
};

const onDrop = (event: DragEvent) => {
	dragging.value = false;
	const file = event.dataTransfer?.files?.[0];
	if (file) {
		emit('select', file);
	}
};

const remove = (event: Event) => {
	event.stopPropagation();
	emit('clear');
};
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<div
		class="group relative flex aspect-[4/3] cursor-pointer flex-col overflow-hidden rounded-2xl border border-dashed transition-colors duration-200"
		:class="dragging
			? 'border-accent bg-accent/5'
			: 'border-line bg-surface/60 hover:border-zinc-600 hover:bg-surface'"
		role="button"
		tabindex="0"
		@click="pick"
		@keydown.enter.prevent="pick"
		@keydown.space.prevent="pick"
		@dragenter.prevent="dragging = true"
		@dragover.prevent="dragging = true"
		@dragleave.prevent="dragging = false"
		@drop.prevent="onDrop"
	>
		<input
			ref="input"
			type="file"
			accept="image/png,image/jpeg,image/webp"
			class="hidden"
			@change="onInput"
		>

		<!-- Step badge: number while empty, check once loaded -->
		<span
			class="absolute left-3 top-3 z-10 grid size-6 place-items-center rounded-full border text-xs font-semibold backdrop-blur transition-colors"
			:class="image
				? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
				: 'border-line bg-surface-2 text-zinc-400'"
		>
			<IconCheck
				v-if="image"
				class="size-3.5"
			/>
			<template v-else>
				{{ step }}
			</template>
		</span>

		<!-- Loaded preview -->
		<template v-if="image">
			<div class="checkerboard relative flex flex-1 items-center justify-center overflow-hidden">
				<img
					:src="image.previewUrl"
					:alt="image.name"
					class="max-h-full max-w-full object-contain"
				>
				<button
					type="button"
					class="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-black/60 text-zinc-300 backdrop-blur transition hover:bg-black/80 hover:text-white"
					title="Remove"
					@click="remove"
				>
					<IconX class="size-3.5" />
				</button>
			</div>
			<div class="flex items-center justify-between gap-3 border-t border-line/70 px-4 py-2.5">
				<span class="truncate text-xs text-zinc-400">{{ image.name }}</span>
				<span class="shrink-0 font-mono text-[11px] tabular-nums text-zinc-600">
					{{ image.width }}×{{ image.height }} · {{ formatBytes(image.size) }}
				</span>
			</div>
			<p
				v-if="!image.isLossless"
				class="flex items-start gap-1.5 border-t border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-[11px] leading-relaxed text-amber-400/90"
			>
				<IconTriangleAlert class="mt-px size-3.5 shrink-0" />
				Lossy input — difference matting needs lossless pixels. JPEG and lossy WebP can desync the pair and corrupt the result.
			</p>
		</template>

		<!-- Empty state -->
		<div
			v-else
			class="flex flex-1 flex-col items-center justify-center px-6 text-center"
		>
			<div
				class="mb-4 grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-zinc-500 transition-colors group-hover:text-zinc-300"
			>
				<IconUpload class="size-5" />
			</div>
			<p class="text-sm font-medium text-zinc-300">
				{{ label }}
			</p>
			<p class="mt-1 text-xs text-zinc-500">
				{{ hint }}
			</p>
			<p class="mt-3 text-[11px] text-zinc-600">
				Drop a PNG, JPEG, or WebP, or click to browse
			</p>
		</div>
	</div>
</template>
