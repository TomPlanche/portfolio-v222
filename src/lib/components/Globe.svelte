<script lang="ts">
	import createGlobe from 'cobe';

	let phi = 0;

	const globe = (canvas: HTMLCanvasElement) => {
		const g = createGlobe(canvas, {
			devicePixelRatio: 2,
			width: canvas.offsetWidth * 2,
			height: canvas.offsetWidth * 2,
			phi: 0,
			theta: 0.3,
			dark: 1,
			diffuse: 1.2,
			mapSamples: 16000,
			mapBrightness: 6,
			baseColor: [0.3, 0.3, 0.3],
			markerColor: [0.1, 0.8, 1],
			glowColor: [0.2, 0.2, 0.2],

			markers: [{ location: [48.8566, 2.3522], size: 0.02 }],
			markerElevation: 0.01
		});

		let rafId: number;

		const animate = () => {
			phi += 0.005;
			g.update({ phi });

			rafId = requestAnimationFrame(animate);
		};

		rafId = requestAnimationFrame(animate);

		return () => {
			cancelAnimationFrame(rafId);
			g.destroy();
		};
	};
</script>

<canvas {@attach globe}></canvas>

<style>
    canvas {
        width: 100%;
        aspect-ratio: 1;
    }
</style>
