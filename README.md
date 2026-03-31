# tomplanche.com

Personal portfolio site. Single-page, server-side rendered, built with a focus on small details over heavy dependencies.

## Stack

- **SvelteKit** with **Svelte 5** (runes-based reactivity: `$state`, `$props`, `$effect`)
- **TypeScript** throughout
- **SCSS** for styles
- **Vite** as the build tool
- **Bun** as the package manager and runtime
- **Node adapter** (`@sveltejs/adapter-node`) for self-hosted deployment

## Notable pieces

### Pixel reveal transitions

Two canvas-based pixel dissolve animations drive the visual transitions:

- **PixelReveal** runs as a full-screen overlay on page load. A grid of rectangles sweeps top-to-bottom, each cell briefly flashing blue before clearing to expose the page.
- **ImageReveal** wraps individual project cards. The same dissolve mechanic is scoped to the element's bounding box and fires once the element enters the viewport via `IntersectionObserver`. It waits for the page-enter animation to complete first.

Both effects draw directly to a `<canvas>` element each frame using `requestAnimationFrame`, with per-cell timing noise added around a linear sweep to avoid a mechanical look. The approach is inspired by the scroll-revealed WebGL gallery technique described at [tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js](https://tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js/).

### Interactive globe

The projects section includes a draggable 3D globe built with a local fork of [Cobe](https://github.com/tomPlanche/cobe), linked via `bun link` while pending PRs are merged upstream. A set of satellite markers is distributed across the surface with arcs connecting them. If the visitor grants geolocation permission, their coordinates are plotted as an additional marker and arcs are drawn from the four nearest satellites to their location.

### Geolocation state

A small Svelte 5 reactive store (`geolocation.svelte.ts`) wraps `navigator.geolocation.getCurrentPosition`. It exposes `coords`, `error`, and `loading` as reactive getters, making it easy to wire into any component without a framework or library.

### Noise overlay

A fixed, full-viewport `<div>` tiled with a looping noise GIF sits above everything at a low opacity. It adds a subtle film grain texture without any JS.

### Footer

The footer pulls the latest Git commit SHA and URL from the GitHub API at request time (via the SvelteKit layout server load). It links directly to the commit on GitHub.

