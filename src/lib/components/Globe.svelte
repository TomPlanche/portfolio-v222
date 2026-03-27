<script lang="ts">
	import type { Arc } from 'cobe';
	import createGlobe from 'cobe';

	let { userLocation = null }: { userLocation?: [number, number] | null } = $props();

	const USER_MARKER_ID = 'user-location';

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

	const satCoords = Object.fromEntries(satelliteMarkers.map(s => [s.id, s.location]));


	const satArcs: Arc[] = [
		// Northern network
		['sat-1', 'sat-4'],
		['sat-4', 'sat-9'],
		['sat-9', 'sat-7'],
		['sat-7', 'sat-14'],
		['sat-1', 'sat-11'],
		['sat-11', 'sat-4'],
		// Cross-equatorial
		['sat-11', 'sat-10'],
		['sat-10', 'sat-5'],
		['sat-13', 'sat-8'],
		['sat-2', 'sat-8'],
		['sat-2', 'sat-3'],
		// Eastern network
		['sat-7', 'sat-2'],
		['sat-3', 'sat-6'],
		['sat-6', 'sat-12'],
		['sat-3', 'sat-15'],
		// Pacific
		['sat-1', 'sat-16'],
		['sat-16', 'sat-6']
	]
		.map(([a, b]) => ({
			from: satCoords[a],
			to: satCoords[b]
		}));

	let phi = 0;
	let theta = 0.2;
	let isDragging = false;
	let hasDragged = false;
	let lastX = 0;
	let lastY = 0;

	const getDistance = (a: [number, number], b: [number, number]): number => {
		const dLat = a[0] - b[0];
		const dLon = a[1] - b[1];
		return Math.sqrt(dLat * dLat + dLon * dLon);
	};

	const buildArcs = (): Arc[] => {
		if (!userLocation) return satArcs;

		const closest = [...satelliteMarkers]
			.sort((a, b) => getDistance(a.location, userLocation!) - getDistance(b.location, userLocation!))
			.slice(0, 4);

		const userArcs: Arc[] = closest.map((s) => ({
			from: s.location,
			to: userLocation!,
			toElevation: 0,
			color: [1.0, 0.23, 0.19] as [number, number, number]
		}));

		return [...satArcs, ...userArcs];
	};

	const buildMarkers = () => [
		...satelliteMarkers.map((m) => ({ ...m, size: 0.03 })),
		...(userLocation ? [{
			id: USER_MARKER_ID,
			location: userLocation,
			size: 0.05,
			color: [1.0, 0.23, 0.19] as [number, number, number],
			elevation: 0
		}] : [])
	];

	const globe = (canvas: HTMLCanvasElement) => {
		const g = createGlobe(canvas, {
			devicePixelRatio: 2,
			width: canvas.offsetWidth * 2,
			height: canvas.offsetWidth * 2,
			phi,
			theta: 0.2,
			dark: 1,
			diffuse: 1.5,
			scale: 1.1,
			offset: [0, 20],
			mapSamples: 24000,
			mapBrightness: 20,
			baseColor: [0.07, 0.074, 0.086],
			markerColor: [0.55, 0.76, 1.0],
			glowColor: [0.55, 0.76, 1.0],
			arcColor: [0.55, 0.76, 1.0],
			arcWidth: 0.5,
			arcHeight: userLocation ? 0.05 : 0.25,
			arcs: buildArcs(),
			markers: buildMarkers(),
			markerElevation: 0.05
		});

		let rafId: number;

		const animate = () => {
			if (!isDragging) {
				phi += 0.005;
			}
			g.update({ phi, theta, markers: buildMarkers(), arcs: buildArcs(), arcHeight: userLocation ? 0.05 : 0.25 });
			rafId = requestAnimationFrame(animate);
		};

		rafId = requestAnimationFrame(animate);

		const onPointerDown = (e: PointerEvent) => {
			e.preventDefault();
			isDragging = true;
			hasDragged = false;
			lastX = e.clientX;
			lastY = e.clientY;
			canvas.setPointerCapture(e.pointerId);
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!isDragging) return;
			const dx = e.clientX - lastX;
			const dy = e.clientY - lastY;
			if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
				hasDragged = true;
			}
			phi += dx * 0.005;
			theta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, theta + dy * 0.005));
			lastX = e.clientX;
			lastY = e.clientY;
		};

		const onPointerUp = () => {
			isDragging = false;
		};

		const onClick = (e: MouseEvent) => {
			if (hasDragged) {
				e.preventDefault();
				e.stopPropagation();
				hasDragged = false;
			}
		};

		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);
		canvas.addEventListener('click', onClick);

		return () => {
			cancelAnimationFrame(rafId);
			g.destroy();
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
			canvas.removeEventListener('click', onClick);
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

	{#if userLocation}
		<div
			class="live-badge"
			style="position-anchor: --cobe-{USER_MARKER_ID}; opacity: var(--cobe-visible-{USER_MARKER_ID}, 0); filter: blur(calc((1 - var(--cobe-visible-{USER_MARKER_ID}, 0)) * 8px));"
		>
			<span class="live-dot"></span>
			<span class="live-text">You</span>
		</div>
	{/if}
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

    .live-badge {
        position: absolute;
        bottom: anchor(top);
        left: anchor(center);
        translate: -50% 0;
        margin-bottom: 6px;

        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.3rem 0.55rem;

        background: #121316;
        border: 1px solid rgba(255, 59, 48, 0.3);
        border-radius: 3px;

        transition: opacity 0.4s, filter 0.4s;
        pointer-events: none;
        white-space: nowrap;
    }

    .live-dot {
        width: 7px;
        height: 7px;
        background: #ff3b30;
        border-radius: 50%;
        box-shadow: 0 0 6px #ff3b30;
        animation: live-pulse 1.5s ease-in-out infinite;
        flex-shrink: 0;
    }

    @keyframes live-pulse {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(0.8);
        }
    }

    .live-text {
        font-family: "Supply Mono", monospace;
        font-size: 0.55rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        color: #ff3b30;
        text-transform: uppercase;
    }
</style>
