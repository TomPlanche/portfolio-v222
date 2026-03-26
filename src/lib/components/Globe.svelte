<script lang="ts">
	import createGlobe from 'cobe';

	const satelliteMarkers = [
		{ id: 'sat-1', location: [45.0, -120.0] as [number, number] },
		{ id: 'sat-2', location: [30.0, 45.0] as [number, number] },
		{ id: 'sat-3', location: [-15.0, 100.0] as [number, number] },
		{ id: 'sat-4', location: [60.0, -30.0] as [number, number] },
		{ id: 'sat-5', location: [-40.0, -60.0] as [number, number] },
		{ id: 'sat-6', location: [10.0, 150.0] as [number, number] },
		{ id: 'sat-7', location: [55.0, 80.0] as [number, number] },
		{ id: 'sat-8', location: [-25.0, 20.0] as [number, number] },
		{ id: 'sat-9', location: [70.0, 25.0] as [number, number] },
		{ id: 'sat-10', location: [-5.0, -75.0] as [number, number] },
		{ id: 'sat-11', location: [35.0, -95.0] as [number, number] },
		{ id: 'sat-12', location: [-50.0, 140.0] as [number, number] },
		{ id: 'sat-13', location: [20.0, -20.0] as [number, number] },
		{ id: 'sat-14', location: [50.0, 120.0] as [number, number] },
		{ id: 'sat-15', location: [-30.0, 70.0] as [number, number] },
		{ id: 'sat-16', location: [5.0, -150.0] as [number, number] }
	];

	import type { Arc } from 'cobe';

	const satArcs: Arc[] = [
		// Northern network
		{ from: [45.0, -120.0], to: [60.0, -30.0] },
		{ from: [60.0, -30.0], to: [70.0, 25.0] },
		{ from: [70.0, 25.0], to: [55.0, 80.0] },
		{ from: [55.0, 80.0], to: [50.0, 120.0] },
		{ from: [45.0, -120.0], to: [35.0, -95.0] },
		{ from: [35.0, -95.0], to: [60.0, -30.0] },
		// Cross-equatorial
		{ from: [35.0, -95.0], to: [-5.0, -75.0] },
		{ from: [-5.0, -75.0], to: [-40.0, -60.0] },
		{ from: [20.0, -20.0], to: [-25.0, 20.0] },
		{ from: [30.0, 45.0], to: [-25.0, 20.0] },
		{ from: [30.0, 45.0], to: [-15.0, 100.0] },
		// Eastern network
		{ from: [55.0, 80.0], to: [30.0, 45.0] },
		{ from: [-15.0, 100.0], to: [10.0, 150.0] },
		{ from: [10.0, 150.0], to: [-50.0, 140.0] },
		{ from: [-15.0, 100.0], to: [-30.0, 70.0] },
		// Pacific
		{ from: [45.0, -120.0], to: [5.0, -150.0] },
		{ from: [5.0, -150.0], to: [10.0, 150.0] },
	];

	let phi = 0;
	let theta = 0.2;
	let isDragging = false;
	let lastX = 0;
	let lastY = 0;

	const globe = (canvas: HTMLCanvasElement) => {
		const g = createGlobe(canvas, {
			devicePixelRatio: 2,
			width: canvas.offsetWidth * 2,
			height: canvas.offsetWidth * 2,
			phi,
			theta: 0.2,
			dark: 1,
			diffuse: 1.5,
			mapSamples: 16000,
			mapBrightness: 20,
			baseColor: [0.07, 0.074, 0.086],
			markerColor: [0.55, 0.76, 1.0],
			glowColor: [0.55, 0.76, 1.0],
			arcColor: [0.55, 0.76, 1.0],
			arcWidth: 0.5,
			arcHeight: 0.25,
			arcs: satArcs,
			markers: satelliteMarkers.map((m) => ({ ...m, size: 0.03 })),
			markerElevation: 0.05
		});

		let rafId: number;

		const animate = () => {
			if (!isDragging) {
				phi += 0.005;
			}
			g.update({ phi, theta });
			rafId = requestAnimationFrame(animate);
		};

		rafId = requestAnimationFrame(animate);

		const onPointerDown = (e: PointerEvent) => {
			e.preventDefault();
			isDragging = true;
			lastX = e.clientX;
			lastY = e.clientY;
			canvas.setPointerCapture(e.pointerId);
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!isDragging) return;
			const dx = e.clientX - lastX;
			const dy = e.clientY - lastY;
			phi += dx * 0.005;
			theta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, theta - dy * 0.005));
			lastX = e.clientX;
			lastY = e.clientY;
		};

		const onPointerUp = () => {
			isDragging = false;
		};

		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);

		return () => {
			cancelAnimationFrame(rafId);
			g.destroy();
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
		};
	};
</script>

<div class="globe-wrapper">
	<canvas {@attach globe}></canvas>

	{#each satelliteMarkers as m (m.id)}
		<div
			class="satellite"
			style="position-anchor: --cobe-{m.id}; opacity: var(--cobe-visible-{m.id}, 0); filter: blur(calc((1 - var(--cobe-visible-{m.id}, 0)) * 8px));"
		>
			🛰️
		</div>
	{/each}
</div>

<style>
    .globe-wrapper {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
    }

    canvas {
        width: 100%;
        height: 100%;
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    }

    .satellite {
        position: absolute;
        bottom: anchor(top);
        left: anchor(center);
        transform: translateX(-50%);
        transition: opacity 0.3s, filter 0.3s;
        font-size: 1rem;
        pointer-events: none;
    }
</style>
