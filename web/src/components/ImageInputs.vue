<script setup lang="ts">
import exampleOnBlack from '../assets/example/on-black.png';
import exampleOnWhite from '../assets/example/on-white.png';
import { useMattingStore } from '../composables/use-matting.ts';
import { IconMinus, IconSparkles } from '../icons.ts';
import DropZone from './DropZone.vue';

const {
	image1, image2, options, setImage, clearImage, reset,
} = useMattingStore();

const fetchImage = async (url: string, name: string): Promise<File> => {
	const response = await fetch(url);
	const blob = await response.blob();
	return new File([blob], name, { type: 'image/png' });
};

const loadExample = () => {
	// The two example renders aren't pixel-identical, so the solid areas would
	// otherwise come out slightly translucent. Snap near-opaque alpha to fully
	// opaque so the demo reads cleanly.
	reset();
	options.ceiling = 0.8;

	// Pass the fetches straight to the store: it claims each slot immediately, so
	// a manual pick during the fetch still wins.
	return Promise.all([
		setImage(1, fetchImage(exampleOnWhite, 'mac-ocr-on-white.png')),
		setImage(2, fetchImage(exampleOnBlack, 'mac-ocr-on-black.png')),
	]);
};
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<div
		id="image-inputs"
		class="scroll-mt-6"
	>
		<div
			v-if="!image1 && !image2"
			class="mb-3 flex justify-end"
		>
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-surface hover:text-white"
				@click="loadExample"
			>
				<IconSparkles class="size-4 text-accent" />
				Try an example
			</button>
		</div>

		<div class="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
			<div class="md:flex-1">
				<DropZone
					:step="1"
					label="Drop the first image"
					hint="Your subject on a flat solid background"
					:image="image1"
					@select="setImage(1, $event)"
					@clear="clearImage(1)"
				/>
			</div>
			<div class="flex items-center justify-center md:flex-col">
				<span class="grid size-9 place-items-center rounded-full border border-line bg-surface text-zinc-500">
					<IconMinus class="size-4" />
				</span>
			</div>
			<div class="md:flex-1">
				<DropZone
					:step="2"
					label="Drop the matching image"
					hint="Same subject, distinctly different background"
					:image="image2"
					@select="setImage(2, $event)"
					@clear="clearImage(2)"
				/>
			</div>
		</div>
	</div>
</template>
