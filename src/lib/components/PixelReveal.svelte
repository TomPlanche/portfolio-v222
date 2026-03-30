<script lang="ts">
	import { pageReveal } from '$lib/pageReveal.svelte';

	const PIXEL_SIZE = 24;
	const DURATION = 1400;
	const FLASH_WINDOW = 120;
	const NOISE_RANGE = 300; // ms of random jitter around the sweep line
	const ZED_DARK = '#121316';
	const ZED_BLUE = 'oklch(80.9% .105 251.813)';

	/**
	 * Attachment that runs the pixel dissolve animation on the canvas element.
	 * Fills the canvas immediately with the dark color to avoid a transparent flash,
	 * then animates a top-to-bottom sweep where each pixel flashes blue before clearing.
	 * Returns a cleanup function that cancels the animation frame on unmount.
	 *
	 * @param canvas - The canvas element to draw on.
	 * @returns Cleanup function that cancels the pending animation frame.
	 */
	const reveal = (canvas: HTMLCanvasElement) => {
		const ctx = canvas.getContext('2d');

		if (!ctx) return;

		const w = window.innerWidth;
		const h = window.innerHeight;
		canvas.width = w;
		canvas.height = h;

		// Fill synchronously before first rAF to avoid transparent flash
		ctx.fillStyle = ZED_DARK;
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

		// Top-to-bottom sweep with per-pixel noise on the timing
		const revealAt = new Float32Array(total);
		for (let i = 0; i < total; i++) {
			const row = Math.floor(i / cols);
			const base = (row / rows) * DURATION;
			const noise = (Math.random() - 0.5) * NOISE_RANGE;
			revealAt[i] = Math.max(0, Math.min(DURATION, base + noise));
		}

		let rafId: number;
		const start = performance.now();

		/**
		 * Called each animation frame. Clears the canvas and redraws only the pixels
		 * that haven't been revealed yet (dark) or are mid-transition (blue flash).
		 * Pixels whose revealAt time has passed by more than FLASH_WINDOW are simply
		 * left undrawn, making them transparent and exposing the content below.
		 *
		 * @param now - DOMHighResTimeStamp provided by requestAnimationFrame.
		 */
		const frame = (now: number) => {
			const elapsed = now - start;
			ctx.clearRect(0, 0, w, h);

			ctx.fillStyle = ZED_DARK;
			for (let i = 0; i < total; i++) {
				if (elapsed < revealAt[i]) {
					ctx.fillRect(px[i], py[i], PIXEL_SIZE, PIXEL_SIZE);
				}
			}

			ctx.fillStyle = ZED_BLUE;
			for (let i = 0; i < total; i++) {
				const t = revealAt[i];
				if (elapsed >= t && elapsed < t + FLASH_WINDOW) {
					ctx.fillRect(px[i], py[i], PIXEL_SIZE, PIXEL_SIZE);
				}
			}

			if (elapsed < DURATION + FLASH_WINDOW) {
				rafId = requestAnimationFrame(frame);
			} else {
				pageReveal.complete();
			}
		};

		rafId = requestAnimationFrame(frame);

		return () => cancelAnimationFrame(rafId);
	};
</script>

{#if !pageReveal.done}
	<canvas {@attach reveal}></canvas>
{/if}

<style>
    canvas {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 9999;
        width: 100vw;
        height: 100vh;
    }
</style>
