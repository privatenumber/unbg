<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMattingStore } from '../composables/use-matting.ts';
import { IconCircleAlert, IconDownload, IconLoaderCircle } from '../icons.ts';
import { formatBytes, rgbToCss } from '../lib/format.ts';
import BackdropToggle from './BackdropToggle.vue';

const { image1, image2, result, status, error } = useMattingStore();

const trimSeparators = (value: string) => value.replaceAll(/^[\s._-]+|[\s._-]+$/g, '');

const fileStem = (name: string) => {
	const extensionIndex = name.lastIndexOf('.');
	return extensionIndex > 0 ? name.slice(0, extensionIndex) : name;
};

const downloadName = computed(() => {
	const first = image1.value;
	const second = image2.value;
	if (!first || !second) {
		return 'unbg.png';
	}

	const firstStem = fileStem(first.name);
	const secondStem = fileStem(second.name);
	let length = 0;
	while (length < firstStem.length && length < secondStem.length && firstStem[length] === secondStem[length]) {
		length += 1;
	}

	const name = trimSeparators(firstStem.slice(0, length)) || firstStem;
	return `unbg-${name}.png`;
});

const weakBackgrounds = computed(() => {
	const current = result.value;
	return current ? current.backgroundDistance < 50 : false;
});

const showResult = computed(() => Boolean(result.value) && status.value !== 'error');

// The CSS color rendered behind the result (null = transparent checkerboard).
const backdropColor = ref<string | null>(null);
const onCheckerboard = computed(() => !(showResult.value && backdropColor.value));
const previewStyle = computed(() => {
	const color = backdropColor.value;
	return showResult.value && color ? { backgroundColor: color } : {};
});
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<section class="overflow-hidden rounded-2xl border border-line bg-surface/60">
		<header class="flex items-center justify-between gap-3 border-b border-line/70 px-5 py-3">
			<div class="flex items-center gap-2.5">
				<h2 class="text-sm font-medium text-zinc-300">
					Result
				</h2>
				<IconLoaderCircle
					v-if="status === 'processing'"
					class="size-3.5 animate-spin text-accent"
				/>
			</div>
			<a
				v-if="result && status !== 'error'"
				:href="result.url"
				:download="downloadName"
				class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-2 px-3.5 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
			>
				<IconDownload class="size-4" />
				Download
			</a>
		</header>

		<div
			class="relative grid min-h-[20rem] place-items-center p-4 sm:min-h-[26rem]"
			:class="{ checkerboard: onCheckerboard }"
			:style="previewStyle"
		>
			<!-- Error (takes priority over a stale result) -->
			<div
				v-if="status === 'error'"
				class="mx-auto max-w-sm text-center"
			>
				<div class="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-red-500/10 text-red-400">
					<IconCircleAlert class="size-5" />
				</div>
				<p class="text-sm text-red-300/90">
					{{ error }}
				</p>
			</div>

			<!-- Result preview -->
			<img
				v-else-if="result"
				:src="result.url"
				alt="Extracted transparent image"
				class="max-h-[24rem] max-w-full object-contain fade-in"
			>

			<!-- Processing (first run, no prior result) -->
			<div
				v-else-if="status === 'processing'"
				class="flex flex-col items-center gap-3 text-zinc-400"
			>
				<IconLoaderCircle class="size-6 animate-spin text-accent" />
				<span class="text-sm">Extracting transparency…</span>
			</div>

			<!-- Preview backdrop toggle (visual only — the downloaded PNG is unchanged) -->
			<BackdropToggle
				v-if="showResult"
				v-model="backdropColor"
				class="absolute bottom-3 left-3"
			/>
		</div>

		<!-- Metadata -->
		<footer
			v-if="result && status !== 'error'"
			class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/70 px-5 py-3 text-xs text-zinc-500"
		>
			<span class="font-mono tabular-nums">{{ result.width }}×{{ result.height }}</span>
			<span class="font-mono tabular-nums">{{ formatBytes(result.size) }}</span>
			<span class="flex items-center gap-1.5">
				<span
					class="inline-block size-3 rounded-sm border border-line"
					:style="{ background: rgbToCss(result.background1) }"
				/>
				<span
					class="inline-block size-3 rounded-sm border border-line"
					:style="{ background: rgbToCss(result.background2) }"
				/>
				backgrounds
			</span>
			<span
				class="font-mono tabular-nums"
				:class="weakBackgrounds ? 'text-amber-400' : ''"
			>
				Δ {{ result.backgroundDistance.toFixed(0) }}
			</span>
			<span
				v-if="weakBackgrounds"
				class="text-amber-400/80"
			>
				backgrounds too similar — use more distinct colors
			</span>
		</footer>
	</section>
</template>
