<script setup lang="ts">
import { provideMatting } from './composables/use-matting.ts';
import AdvancedControls from './components/AdvancedControls.vue';
import AppFooter from './components/AppFooter.vue';
import AppHeader from './components/AppHeader.vue';
import AppHero from './components/AppHero.vue';
import CliTip from './components/CliTip.vue';
import ImageInputs from './components/ImageInputs.vue';
import ResultPanel from './components/ResultPanel.vue';

const { showOutput } = provideMatting();
</script>

<template>
	<div class="mx-auto flex min-h-dvh max-w-5xl flex-col px-5">
		<AppHeader />

		<main class="flex-1">
			<AppHero>
				<CliTip />
			</AppHero>
			<ImageInputs />

			<div
				v-if="showOutput"
				class="mt-4 fade-in"
			>
				<ResultPanel />
			</div>

			<AdvancedControls
				v-if="showOutput"
				class="mt-4"
			/>
		</main>

		<AppFooter />
	</div>
</template>
