<template>
	<!-- eslint-disable @stylistic/max-len -- Tailwind utility class strings -->
	<section class="mb-8 rounded-2xl border border-line bg-surface/70 p-5 sm:p-6">
		<div class="mx-auto max-w-3xl">
			<p class="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-accent">
				Prepare Your Images
			</p>
			<h2 class="mt-2 text-balance text-xl font-semibold text-zinc-100 sm:text-2xl">
				Make a matching pair on different backgrounds
			</h2>
			<p class="mt-2 text-pretty text-sm leading-relaxed text-zinc-400">
				Black and white are the easiest pair, but any distinctly different solid colors work.
			</p>

			<ol class="mt-5 grid gap-3 sm:grid-cols-3">
				<li class="rounded-xl border border-line bg-surface-2/80 p-4">
					<span class="grid size-7 place-items-center rounded-full bg-accent font-mono text-xs font-bold text-white">1</span>
					<h3 class="mt-3 text-sm font-semibold text-zinc-100">
						Start with a solid background
					</h3>
					<p class="mt-1.5 text-xs leading-relaxed text-zinc-400">
						Keep it if the background is already solid. Otherwise, ask Gemini Nano Banana or another AI image editor to make it solid.
					</p>
				</li>
				<li class="rounded-xl border border-line bg-surface-2/80 p-4">
					<span class="grid size-7 place-items-center rounded-full bg-accent-2 font-mono text-xs font-bold text-zinc-950">2</span>
					<h3 class="mt-3 text-sm font-semibold text-zinc-100">
						Change only the background
					</h3>
					<p class="mt-1.5 text-xs leading-relaxed text-zinc-400">
						Edit it onto a distinctly different solid color. If the original is black, make this one white.
					</p>
				</li>
				<li class="rounded-xl border border-line bg-surface-2/80 p-4">
					<span class="checker-swatch grid size-7 place-items-center rounded-full font-mono text-xs font-bold text-white">3</span>
					<h3 class="mt-3 text-sm font-semibold text-zinc-100">
						Drop both into unbg
					</h3>
					<p class="mt-1.5 text-xs leading-relaxed text-zinc-400">
						Add the matching pair below. unbg compares them and recovers a transparent PNG.
					</p>
				</li>
			</ol>

			<div class="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
				<p class="text-xs font-semibold text-zinc-200">
					Prompt for the second version
				</p>
				<p class="mt-2 font-mono text-xs leading-relaxed text-zinc-400">
					Keep the subject, composition, dimensions, lighting, colors, and every visible detail unchanged. Change only the background to a flat solid [TARGET COLOR, e.g. pure white (#ffffff)]. Do not move, redraw, resize, or restyle the subject.
				</p>
			</div>
		</div>
	</section>
</template>
