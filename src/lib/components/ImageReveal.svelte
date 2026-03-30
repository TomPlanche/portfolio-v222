<script lang="ts">
	import type { Snippet } from 'svelte';
	import { pageReveal } from '$lib/pageReveal.svelte';

	type Props = {
		children: Snippet;
	};

	const { children }: Props = $props();

	const PIXEL_SIZE = 12;
	const DURATION = 900;
	const FLASH_WINDOW = 100;
	const NOISE_RANGE = 200;
	const FILL_COLOR = '#121316';
	const FLASH_COLOR = 'oklch(80.9% .105 251.813)';

	let revealed = $state(false);

	const attach = (canvas: HTMLCanvasElement) => {
		const wrapper = canvas.parentElement;
		if (!wrapper) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let animating = false;

		// Fill the canvas with the cover color, resizing pixel dimensions to match the
		// wrapper. Called immediately and again via ResizeObserver in case the wrapper
		// has no height yet (e.g. external image not yet loaded).
		const cover = () => {
			const w = canvas.offsetWidth;
			const h = canvas.offsetHeight;
			if (w === 0 || h === 0) return;
			canvas.width = w;
			canvas.height = h;
			ctx.fillStyle = FILL_COLOR;
			ctx.fillRect(0, 0, w, h);
		};

		cover();

		// Watch for dimension changes until the animation starts (handles late-loading
		// external images whose wrapper starts at zero height).
		const ro = new ResizeObserver(() => {
			if (!animating) cover();
		});
		ro.observe(wrapper);

		const runReveal = () => {
			animating = true;
			ro.disconnect();

			const w = canvas.width;
			const h = canvas.height;

			ctx.fillStyle = FILL_COLOR;
			ctx.fillRect(0, 0, w, h);

			const cols = Math.ceil(w / PIXEL_SIZE);
			const rows = Math.ceil(h / PIXEL_SIZE);
			const total = cols * rows;

			const px = new Int16Array(total);
			const py = new Int16Array(total);
			for (let i = 0; i < total; i++) {
				px[i] = (i % cols) * PIXEL_SIZE;
				py[i] = Math.floor(i / cols) * PIXEL_SIZE;
			}

			const revealAt = new Float32Array(total);
			for (let i = 0; i < total; i++) {
				const row = Math.floor(i / cols);
				const base = (row / rows) * DURATION;
				const noise = (Math.random() - 0.5) * NOISE_RANGE;

				revealAt[i] = Math.max(0, Math.min(DURATION, base + noise));
			}

			let rafId: number;
			const start = performance.now();

			const frame = (now: number) => {
				const elapsed = now - start;
				ctx.clearRect(0, 0, w, h);

				ctx.fillStyle = FILL_COLOR;
				for (let i = 0; i < total; i++) {
					if (elapsed < revealAt[i]) {
						ctx.fillRect(px[i], py[i], PIXEL_SIZE, PIXEL_SIZE);
					}
				}

				ctx.fillStyle = FLASH_COLOR;
				for (let i = 0; i < total; i++) {
					const t = revealAt[i];
					if (elapsed >= t && elapsed < t + FLASH_WINDOW) {
						ctx.fillRect(px[i], py[i], PIXEL_SIZE, PIXEL_SIZE);
					}
				}

				if (elapsed < DURATION + FLASH_WINDOW) {
					rafId = requestAnimationFrame(frame);
				} else {
					revealed = true;
				}
			};

			rafId = requestAnimationFrame(frame);

			return () => cancelAnimationFrame(rafId);
		};

		const tryReveal = () => {
			if (!pageReveal.done) {
				requestAnimationFrame(tryReveal);

				return;
			}

			runReveal();
		};

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						observer.disconnect();
						tryReveal();
					}
				}
			},
			{ rootMargin: '0px 0px -15% 0px', threshold: 0 }
		);

		observer.observe(wrapper);

		return () => {
			observer.disconnect();
			ro.disconnect();
		};
	};
</script>

<div class="image-reveal">
	{@render children()}
	{#if !revealed}
		<canvas {@attach attach}></canvas>
	{/if}
</div>

<style>
    .image-reveal {
        position: relative;
    }

    canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
    }
</style>
