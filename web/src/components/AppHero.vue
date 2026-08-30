<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<section class="py-8 text-center sm:py-12">
		<div class="relative mx-auto mb-5 w-28 sm:mb-6 sm:w-32">
			<span
				aria-hidden="true"
				class="absolute inset-[20%] rounded-full bg-accent/35 blur-2xl"
			/>
			<img
				src="/logo.webp"
				width="400"
				height="430"
				alt="unbg logo"
				class="relative h-auto w-full drop-shadow-[0_12px_24px_rgb(34_211_238_/_0.18)]"
			>
		</div>
		<h1 class="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-[2.7rem] sm:leading-[1.1]">
			Strip solid backgrounds to <span class="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">transparency</span>
		</h1>
		<p class="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-zinc-400 sm:text-base">
			Create two matching versions of your image on different solid colors, then unbg diffs the background out.
		</p>
		<p class="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-zinc-500">
			<span class="size-1.5 rounded-full bg-emerald-400" />
			Runs entirely in your browser. No upload or server.
		</p>
	</section>
</template>
