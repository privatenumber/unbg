<script setup lang="ts">
import { IconChevronDown } from '../icons.ts';

defineProps<{
	title: string;
}>();

// Self-managed when no `v-model:open` is bound by the parent.
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<div class="overflow-hidden rounded-2xl border border-line bg-surface/40">
		<button
			type="button"
			class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60"
			:aria-expanded="open"
			@click="open = !open"
		>
			<slot name="icon" />
			<span class="flex-1 text-sm font-medium text-zinc-200">{{ title }}</span>
			<IconChevronDown
				class="size-4 shrink-0 text-zinc-500 transition-transform duration-200"
				:class="open ? 'rotate-180' : ''"
			/>
		</button>
		<div
			v-if="open"
			class="border-t border-line/70 px-4 py-4"
		>
			<slot />
		</div>
	</div>
</template>
