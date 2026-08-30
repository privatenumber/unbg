<script setup lang="ts">
import { IconTerminal } from '../icons.ts';
import Disclosure from './Disclosure.vue';
</script>

<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<Disclosure
		title="Want a CLI or agent workflow?"
		class="mx-auto mt-6 max-w-2xl text-left"
	>
		<template #icon>
			<span class="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-accent">
				<IconTerminal class="size-4" />
			</span>
		</template>
		<p class="text-sm leading-relaxed text-zinc-400">
			Run unbg locally from your own terminal. No website needed. Coding agents like Claude Code and Codex can also automate it with the included agent skill:
		</p>
		<pre class="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-xs text-zinc-300"><code>npx unbg on-white.png on-black.png</code></pre>
	</Disclosure>
</template>
