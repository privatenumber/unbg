<script setup lang="ts">
import { IconGithub } from '../icons.ts';
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<header class="flex items-center justify-between py-5">
		<span class="font-mono text-lg font-semibold tracking-tight">
			<span class="text-zinc-100">un</span><span class="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">bg</span>
		</span>
		<a
			href="https://github.com/privatenumber/unbg"
			target="_blank"
			rel="noreferrer"
			class="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
		>
			<IconGithub class="size-4" />
			GitHub
		</a>
	</header>
</template>
